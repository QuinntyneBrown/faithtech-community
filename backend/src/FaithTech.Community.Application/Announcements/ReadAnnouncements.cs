using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Announcements;

/// <summary>An announcement as the announcements page lists it: what was sent, by whom and to whom.</summary>
public record AnnouncementListItem(
    Guid Id,
    string Subject,
    string Body,
    DateTimeOffset SentAt,
    string SenderName,
    string AudienceKind,
    IReadOnlyList<string> Roles,
    string? EventTitle,
    int RecipientCount);

public record AnnouncementEmailOptOut(bool OptedOut);

/// <summary>
/// The announcements sent to the caller, newest first (L2-030 AC1), plus those the caller sent (ADR 0015).
/// </summary>
public class ListMyAnnouncementsHandler(IApplicationDbContext db, ICurrentUser current)
{
    public const int PageSize = 25;

    public async Task<PagedResult<AnnouncementListItem>> ListAsync(int page, CancellationToken cancellationToken = default)
    {
        var request = new PageRequest(page, PageSize);
        var me = await CallerProfileIdAsync(db, current, cancellationToken);
        var mine = db.Announcements.AsNoTracking()
            .Where(a => a.SenderId == me || a.Recipients.Any(r => r.ProfileId == me));
        var total = await mine.CountAsync(cancellationToken);
        var rows = await mine
            .OrderByDescending(a => a.SentAt).ThenByDescending(a => a.Id)
            .Skip(request.Skip).Take(request.PageSize)
            .Select(a => new
            {
                a.Id,
                a.Subject,
                a.Body,
                a.SentAt,
                SenderName = db.Profiles.Where(p => p.Id == a.SenderId).Select(p => p.Name).FirstOrDefault(),
                a.Audience,
                EventTitle = db.Events.Where(e => e.Id == a.Audience.EventId).Select(e => e.Title).FirstOrDefault(),
                RecipientCount = a.Recipients.Count,
            })
            .ToListAsync(cancellationToken);

        var items = rows
            .OrderByDescending(r => r.SentAt).ThenByDescending(r => r.Id)
            .Select(r => new AnnouncementListItem(
                r.Id,
                r.Subject,
                r.Body,
                r.SentAt,
                r.SenderName ?? string.Empty,
                r.Audience.Kind.ToString(),
                [.. r.Audience.Roles.Select(role => role.ToString()).Order()],
                r.EventTitle,
                r.RecipientCount))
            .ToList();
        return new PagedResult<AnnouncementListItem>(items, request.Page, request.PageSize, total);
    }

    internal static async Task<Guid> CallerProfileIdAsync(IApplicationDbContext db, ICurrentUser current, CancellationToken cancellationToken) =>
        current.UserId is { } userId
            ? await db.Users.Where(u => u.Id == userId).Select(u => u.ProfileId).SingleOrDefaultAsync(cancellationToken)
            : Guid.Empty;
}

/// <summary>Reads and sets the caller's announcement email opt-out from Settings (L2-030 AC2).</summary>
public class AnnouncementEmailOptOutHandler(IApplicationDbContext db, ICurrentUser current)
{
    public async Task<AnnouncementEmailOptOut> GetAsync(CancellationToken cancellationToken = default)
    {
        var me = await ListMyAnnouncementsHandler.CallerProfileIdAsync(db, current, cancellationToken);
        var optedOut = await db.Profiles.Where(p => p.Id == me).Select(p => p.AnnouncementEmailsOptedOut).SingleOrDefaultAsync(cancellationToken);
        return new AnnouncementEmailOptOut(optedOut);
    }

    public async Task<Result> SetAsync(AnnouncementEmailOptOut command, CancellationToken cancellationToken = default)
    {
        var me = await ListMyAnnouncementsHandler.CallerProfileIdAsync(db, current, cancellationToken);
        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == me, cancellationToken);
        if (profile is null)
        {
            return Result.NotFound();
        }

        profile.SetAnnouncementEmailOptOut(command.OptedOut);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}

/// <summary>
/// Signed, single-purpose unsubscribe tokens for announcement emails (L2-030 AC3, ADR 0015). A token names one
/// profile and works for a year; it can do nothing but turn that profile's announcement emails off.
/// </summary>
public interface IUnsubscribeTokens
{
    string Issue(Guid profileId);

    /// <summary>The profile the token names, or null when it is not a valid, unexpired unsubscribe token.</summary>
    Guid? Read(string? token);
}

public record UnsubscribeCommand(string? Token);

/// <summary>Opts out the recipient an unsubscribe link names, without a sign-in.</summary>
public class UnsubscribeHandler(IApplicationDbContext db, IUnsubscribeTokens tokens)
{
    public const string InvalidMessage = "This unsubscribe link doesn’t work.";

    public async Task<Result> UnsubscribeAsync(UnsubscribeCommand command, CancellationToken cancellationToken = default)
    {
        var profileId = tokens.Read(command.Token);
        var profile = profileId is null ? null : await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return Result.Invalid("Token", InvalidMessage);
        }

        profile.SetAnnouncementEmailOptOut(true);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
