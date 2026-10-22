using FaithTech.Community.Application.Common;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>Someone at the door who didn't RSVP (L2-095). <see cref="CheckInNow"/> is on unless the lead turns it off.</summary>
public record AddWalkInCommand(string? Name, string? Email, bool CheckInNow = true);

/// <summary>The walk-in's row, and whether an existing RSVP was reused rather than a row added (L2-095 AC5).</summary>
public record WalkInResultDto(CheckInAttendeeDto Attendee, bool Reused);

public class AddWalkInValidator : AbstractValidator<AddWalkInCommand>
{
    public const int MaxName = 100;
    public const int MaxEmail = 256;

    public AddWalkInValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Enter their name so the list shows who came.")
            .Must(n => n!.Trim().Length <= MaxName).WithMessage($"Use {MaxName} characters or fewer for the name.");
        RuleFor(x => x.Email)
            .Must(e => e!.Trim().Length <= MaxEmail && IsEmail(e.Trim()))
            .When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Enter an email like name@example.com, or leave it empty.");
    }

    // name@domain.tld: one @, a dot in the domain, no spaces, as the guest RSVP form checks.
    private static bool IsEmail(string value)
    {
        var at = value.IndexOf('@', StringComparison.Ordinal);
        return at > 0 && at == value.LastIndexOf('@') && value.IndexOf(' ', StringComparison.Ordinal) < 0
            && value.LastIndexOf('.') > at + 1 && !value.EndsWith('.');
    }
}

/// <summary>
/// Adds a walk-in at the door (L2-095) for lead roles and System Admins. A verified member's email links the row
/// to their profile; an existing RSVP is reused. It skips capacity and has-started, and sends no confirmation.
/// </summary>
public class AddWalkInHandler(IApplicationDbContext db, EventPermissions permissions, CheckInHandler checkIns, TimeProvider time)
{
    public async Task<(Result Result, WalkInResultDto? WalkIn)> HandleAsync(
        Guid id, AddWalkInCommand command, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanCheckIn || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return (Result.Forbidden(), null);
        }

        var e = await db.Events.Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null)
        {
            return (Result.NotFound(), null);
        }

        var email = string.IsNullOrWhiteSpace(command.Email) ? null : command.Email.Trim();
        Guid? member = null;
        if (email is not null)
        {
            var normalized = email.ToUpperInvariant();
            member = await db.Users.Where(u => u.EmailConfirmed && u.NormalizedEmail == normalized)
                .Select(u => (Guid?)u.ProfileId).FirstOrDefaultAsync(cancellationToken);
        }

        var (rsvp, reused) = e.AddWalkIn(command.Name!, email, member, command.CheckInNow, actor, time.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), new WalkInResultDto(await checkIns.AttendeeAsync(rsvp, cancellationToken), reused));
    }
}
