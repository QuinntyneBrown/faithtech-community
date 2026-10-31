using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Domain.Notes;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

public record ShareNoteCommand(string? Visibility, IReadOnlyList<Guid>? MemberIds, IReadOnlyList<string>? Roles);

/// <summary>
/// Who can see a page (L2-093): Private, Shared with members and roles, or Global. Only the owner or a System
/// Admin; the new recipients are told in-app and by email in the same save (L2-093 AC5, AC6).
/// </summary>
public class ShareNoteHandler(IApplicationDbContext db, NoteAccess access, NoteViews views, NoteShareNotifier notifier, IAuditLog audit)
{
    public const string AudienceMessage = "Choose at least one person or role, or pick another visibility.";

    public async Task<(Result Result, NotePageDto? Page)> HandleAsync(Guid id, ShareNoteCommand command, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var page = await access.FindAsync(id, caller, cancellationToken);
        if (page is null)
        {
            return (Result.NotFound(), null);
        }

        if (!access.CanChange(page, caller))
        {
            return (Result.Forbidden(), null);
        }

        if (page.IsArchived)
        {
            return (Result.Invalid("Visibility", NoteFields.ArchivedMessage), null);
        }

        if (!Enum.TryParse<NoteVisibility>(command.Visibility, out var visibility) || int.TryParse(command.Visibility, out _) || !Enum.IsDefined(visibility))
        {
            return (Result.Invalid("Visibility", "Choose who can see it."), null);
        }

        var members = visibility == NoteVisibility.Shared ? (command.MemberIds ?? []).Distinct().ToList() : [];
        var roles = await RoleKeys.DefinitionsAsync(db, visibility == NoteVisibility.Shared ? command.Roles ?? [] : [], cancellationToken);
        if (roles is null || !roles.All(RoleKeys.IsShareable))
        {
            return (Result.Invalid("Roles", "Choose roles from the list."), null);
        }

        if (members.Count > 0 && await db.Profiles.CountAsync(p => members.Contains(p.Id), cancellationToken) != members.Count)
        {
            return (Result.Invalid("MemberIds", "Choose members who are on FaithTech."), null);
        }

        if (visibility == NoteVisibility.Shared && members.Count == 0 && roles.Count == 0)
        {
            return (Result.Invalid("Visibility", AudienceMessage), null);
        }

        var reached = await notifier.RecipientsAsync(page, cancellationToken);
        var before = Audience(page);
        page.SetAudience(visibility, members, roles);
        if (access.IsOverride(page, caller))
        {
            audit.Record(caller, "note.shared", nameof(NotePage), page.Id.ToString(), before, Audience(page));
        }

        await notifier.NotifyAsync(page, caller, reached, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.DetailAsync(page, caller, cancellationToken));
    }

    private static object Audience(NotePage page) => new
    {
        Visibility = page.Visibility.ToString(),
        Members = page.SharedMembers.Select(m => m.ProfileId).ToList(),
        Roles = page.SharedRoles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key).ToList(),
    };
}

/// <summary>
/// Tells the people a page is shared with (L2-093 AC5, AC6): each named member and every current holder of a named
/// role, de-duplicated, without the owner and suspended members, and only those the previous audience did not reach.
/// </summary>
public class NoteShareNotifier(IApplicationDbContext db, INotificationPublisher publisher)
{
    public async Task<IReadOnlyCollection<Guid>> RecipientsAsync(NotePage page, CancellationToken cancellationToken = default)
    {
        if (page.Visibility != NoteVisibility.Shared)
        {
            return [];
        }

        var members = page.SharedMembers.Select(m => m.ProfileId).ToList();
        var roles = page.SharedRoles.Select(r => r.RoleDefinitionId).ToList();
        var ids = await (
                from user in db.Users
                join profile in db.Profiles on (Guid?)user.Id equals profile.UserId
                where !profile.IsSuspended && profile.Id != page.OwnerId
                where members.Contains(profile.Id) || profile.Roles.Any(r => roles.Contains(r.RoleDefinitionId))
                select profile.Id)
            .ToListAsync(cancellationToken);
        return ids.ToHashSet();
    }

    public async Task NotifyAsync(NotePage page, Guid actor, IReadOnlyCollection<Guid> alreadyReached, CancellationToken cancellationToken = default)
    {
        var recipients = (await RecipientsAsync(page, cancellationToken)).Except(alreadyReached).ToList();
        if (recipients.Count == 0)
        {
            return;
        }

        var owner = await db.Profiles.Where(p => p.Id == page.OwnerId).Select(p => p.Name).SingleAsync(cancellationToken);
        var title = NoteRefs.TitleOf(page.Title);
        var held = await db.Profiles.Where(p => recipients.Contains(p.Id))
            .Select(p => new { p.Id, Roles = p.Roles.Select(r => new HeldShareRole(r.RoleDefinitionId, r.Definition!.Name)).ToList() })
            .ToDictionaryAsync(p => p.Id, p => p.Roles, cancellationToken);
        var heading = $"{owner} shared {title} with you";
        await publisher.PublishAsync(
            recipients,
            NotificationKind.NotePageShared,
            heading,
            $"/notes/{page.Id}",
            actor,
            recipient => new NotificationEmail(heading, Body(owner, title, Via(page, recipient, held))),
            cancellationToken);
    }

    private static string Via(NotePage page, Guid recipient, Dictionary<Guid, List<HeldShareRole>> held)
    {
        if (page.SharedMembers.Any(m => m.ProfileId == recipient))
        {
            return "you";
        }

        return HeldShareRole.Via(page.SharedRoles.Select(r => r.RoleDefinitionId), held.GetValueOrDefault(recipient) ?? []);
    }

    private static string Body(string owner, string title, string via) =>
        $"A page was shared with you\n\n{owner} shared “{title}” with {via}. Open the page:";
}

/// <summary>The share picker (L2-093 AC2): members by name, never suspended ones.</summary>
public class NoteMembersHandler(IApplicationDbContext db)
{
    public const int Limit = 10;

    public async Task<IReadOnlyList<NoteMemberDto>> HandleAsync(string? q, CancellationToken cancellationToken = default)
    {
        var members = from user in db.Users.AsNoTracking()
                      join profile in db.Profiles.AsNoTracking() on (Guid?)user.Id equals profile.UserId
                      where !profile.IsSuspended
                      select profile;
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            members = members.Where(p => p.Name.ToLower().Contains(term));
        }

        var rows = await members.OrderBy(p => p.Name).ThenBy(p => p.Id).Take(Limit)
            .Select(p => new { p.Id, p.Name, HomeCity = p.Chapter == null ? null : p.Chapter.Name, Roles = p.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key).ToList() })
            .ToListAsync(cancellationToken);
        return [.. rows.Select(r => new NoteMemberDto(r.Id, r.Name, r.HomeCity, [.. r.Roles.Order().Select(x => x.ToString())]))];
    }
}

public record NoteMemberDto(Guid Id, string Name, string? ChapterName, IReadOnlyList<string> Roles);
