using System.Security.Cryptography;
using System.Text;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Events;

/// <summary>
/// A public event as anyone with the link sees it (L2-023): no RSVP list, no host's personal name, and no joining
/// link, which goes to people who RSVP in their confirmation.
/// </summary>
public record PublicEventDto(
    Guid Id,
    string Title,
    string Description,
    string Type,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string City,
    string Format,
    string? Venue,
    int RsvpCount,
    bool IsFull,
    bool IsCancelled,
    string? CancellationReason);

public record GuestRsvpCommand(string? Name, string? Email);

public class GuestRsvpValidator : AbstractValidator<GuestRsvpCommand>
{
    public GuestRsvpValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Enter your name so the host knows who’s coming.")
            .Must(n => n!.Trim().Length <= 200).WithMessage("Use 200 characters or fewer for your name.");
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .Must(e => !string.IsNullOrWhiteSpace(e)).WithMessage("Enter an email like name@example.org.")
            .Must(e => e!.Trim().Length <= 256).WithMessage("Use 256 characters or fewer for your email.")
            .Must(e => IsEmail(e!.Trim())).WithMessage("Enter an email like name@example.org.");
    }

    // name@domain.tld: one @, a dot in the domain, no spaces.
    private static bool IsEmail(string value)
    {
        var at = value.IndexOf('@', StringComparison.Ordinal);
        return at > 0 && at == value.LastIndexOf('@') && value.IndexOf(' ', StringComparison.Ordinal) < 0
            && value.LastIndexOf('.') > at + 1 && !value.EndsWith('.');
    }
}

public record CancelGuestRsvpCommand(string? Token);

/// <summary>Guest cancel-link secrets: 32 random bytes, base64url; only the SHA-256 hash is stored.</summary>
public static class GuestRsvpTokens
{
    public static string New() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

/// <summary>
/// Public events for anonymous visitors (L2-023): read a public event, RSVP as a guest with a name and email (no
/// account), and cancel through the link in the confirmation. Members-only and unknown events are not found.
/// </summary>
public class PublicEventsHandler(
    IApplicationDbContext db,
    RsvpHandler rsvps,
    IEmailQueue emails,
    IOptions<WebAppOptions> webApp,
    TimeProvider time)
{
    public async Task<PublicEventDto?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await FindAsync(id, tracked: false, cancellationToken);
        return e is null
            ? null
            : new PublicEventDto(
                e.Id, e.Title, e.Description, e.Type.ToString(), e.StartsAt, e.EndsAt, e.City, e.Format.ToString(), e.Venue,
                e.RsvpCount, e.IsFull, e.IsCancelled, e.CancellationReason);
    }

    /// <summary>One RSVP per event and email, whatever its case (AC5); each RSVP sends a fresh confirmation and cancel link.</summary>
    public async Task<Result> RsvpAsync(Guid id, GuestRsvpCommand command, CancellationToken cancellationToken = default)
    {
        var e = await FindAsync(id, tracked: true, cancellationToken);
        if (e is null)
        {
            return Result.NotFound();
        }

        var name = command.Name!.Trim();
        var address = command.Email!.Trim();
        var existing = e.Rsvps.Any(r => string.Equals(r.GuestEmail, address, StringComparison.OrdinalIgnoreCase));
        if (!existing && RsvpHandler.Refusal(e, time.GetUtcNow()) is { } refusal)
        {
            return Result.Conflict(refusal);
        }

        var rsvp = e.GuestRsvp(name, address, time.GetUtcNow());
        var token = GuestRsvpTokens.New();
        rsvp.IssueCancelToken(GuestRsvpTokens.Hash(token));

        // The RSVP and its confirmation commit together (L2-028).
        var origin = webApp.Value.Origin;
        emails.Enqueue(rsvps.Confirmation(e, rsvp.GuestEmail!, $"{origin}/public/events/{e.Id}",
            $"Can’t come after all? Cancel your RSVP: {origin}/public/events/{e.Id}/cancel-rsvp?token={token}"));
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    /// <summary>Cancels the guest RSVP whose cancel link holds <paramref name="command"/>'s token (AC6).</summary>
    public async Task<Result> CancelAsync(Guid id, CancelGuestRsvpCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Token))
        {
            return Result.NotFound();
        }

        var hash = GuestRsvpTokens.Hash(command.Token.Trim());
        var e = await db.Events.Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        var rsvp = e?.Rsvps.SingleOrDefault(r => r.IsGuest && r.CancelTokenHash == hash);
        if (e is null || rsvp is null)
        {
            return Result.NotFound();
        }

        e.CancelGuestRsvp(rsvp.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private Task<Event?> FindAsync(Guid id, bool tracked, CancellationToken cancellationToken)
    {
        var events = tracked ? db.Events : db.Events.AsNoTracking();
        return events.Include(x => x.Rsvps)
            .SingleOrDefaultAsync(x => x.Id == id && x.Visibility == EventVisibility.Public, cancellationToken);
    }
}
