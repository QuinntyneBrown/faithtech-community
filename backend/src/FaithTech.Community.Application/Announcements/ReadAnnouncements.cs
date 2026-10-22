using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Announcements;

/// <summary>Signed, single-purpose unsubscribe tokens that name a profile without a sign-in (ADR 0016).</summary>
public interface IUnsubscribeTokens
{
    string Issue(Guid profileId);

    /// <summary>The profile the token names, or null when it is forged, malformed or older than a year.</summary>
    Guid? Verify(string token);
}

public record AudienceDto(string Kind, IReadOnlyList<string> Roles);

public record AnnouncementDto(
    Guid Id, string Subject, string Body, DateTimeOffset SentAt, string SenderName, AudienceDto Audience, int RecipientCount);

public record EmailOptOutCommand(bool OptedOut);

public record UnsubscribeCommand(string? Token);

/// <summary>What the caller received or sent, newest first (L2-030 AC1).</summary>
public class ListAnnouncementsHandler(IApplicationDbContext db, ProfileAccess access)
{
    public const int PageSize = 20;

    public async Task<PagedResult<AnnouncementDto>> HandleAsync(int page, CancellationToken cancellationToken = default)
    {
        var request = new PageRequest(page, PageSize);
        var caller = await access.CallerProfileIdAsync(cancellationToken) ?? Guid.Empty;
        var mine = db.Announcements.AsNoTracking()
            .Where(a => a.SenderId == caller || a.Recipients.Any(r => r.ProfileId == caller));
        var total = await mine.CountAsync(cancellationToken);
        var announcements = await mine
            .OrderByDescending(a => a.SentAt)
            .Skip(request.Skip)
            .Take(request.PageSize)
            .Select(a => new { a.Id, a.Subject, a.Body, a.SentAt, a.SenderId, a.Audience.Kind, a.Audience.Roles, Recipients = a.Recipients.Count })
            .ToListAsync(cancellationToken);
        var senderIds = announcements.Select(a => a.SenderId).Distinct().ToList();
        var senders = await db.Profiles.Where(p => senderIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        var items = announcements
            .Select(a => new AnnouncementDto(
                a.Id,
                a.Subject,
                a.Body,
                a.SentAt,
                senders.GetValueOrDefault(a.SenderId, "FaithTech"),
                new AudienceDto(a.Kind.ToString(), [.. a.Roles.Order().Select(r => r.ToString())]),
                a.Recipients))
            .ToList();
        return new PagedResult<AnnouncementDto>(items, request.Page, request.PageSize, total);
    }
}

/// <summary>The caller's announcement email preference; every other email always goes out (L2-030 AC2, L2-052 AC4).</summary>
public class AnnouncementEmailOptOutHandler(IApplicationDbContext db, ProfileAccess access)
{
    public async Task<bool?> GetAsync(CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerProfileIdAsync(cancellationToken);
        return await db.Profiles.Where(p => p.Id == caller).Select(p => (bool?)p.AnnouncementEmailsOptedOut).SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<Result> SetAsync(EmailOptOutCommand command, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerProfileIdAsync(cancellationToken);
        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == caller, cancellationToken);
        if (profile is null)
        {
            return Result.NotFound();
        }

        profile.SetAnnouncementEmailOptOut(command.OptedOut);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}

/// <summary>The email footer's link: opts the token's profile out without a sign-in (L2-030 AC3).</summary>
public class UnsubscribeHandler(IApplicationDbContext db, IUnsubscribeTokens tokens)
{
    public const string BadLink = "This unsubscribe link doesn’t work. Sign in and turn off announcement emails in settings instead.";

    public async Task<Result> HandleAsync(UnsubscribeCommand command, CancellationToken cancellationToken = default)
    {
        var profileId = string.IsNullOrWhiteSpace(command.Token) ? null : tokens.Verify(command.Token);
        var profile = profileId is null ? null : await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return Result.Invalid("Token", BadLink);
        }

        profile.SetAnnouncementEmailOptOut(true);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
