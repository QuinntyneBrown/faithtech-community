using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Partners;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Search;

/// <summary>Every member's profile: profiles are visible to all signed-in members.</summary>
public class PeopleSearchSource(IApplicationDbContext db, IFullTextSearch fullText) : ISearchSource
{
    public SearchResultKind Kind => SearchResultKind.Person;

    public async Task<IReadOnlyList<SearchHit>> SearchAsync(string term, SearchScope scope, int limit, CancellationToken cancellationToken = default)
    {
        var people = await fullText.Match(db.Profiles.AsNoTracking(), term).Take(limit).ToListAsync(cancellationToken);
        return [.. people.Select(p => new SearchHit(
            p.Id,
            p.Name,
            GlobalSearchHandler.Snippet(string.Join(", ", p.Roles.OrderBy(r => r.Role).Select(r => RoleLabels.Of(r.Role))), p.HomeCity, p.Bio),
            $"/people/{p.Id}"))];
    }
}

/// <summary>The caller's own active contacts, System Admin included (ADR 0003, ADR 0014).</summary>
public class ContactSearchSource(IApplicationDbContext db, IFullTextSearch fullText) : ISearchSource
{
    public SearchResultKind Kind => SearchResultKind.Contact;

    public async Task<IReadOnlyList<SearchHit>> SearchAsync(string term, SearchScope scope, int limit, CancellationToken cancellationToken = default)
    {
        if (scope.CallerProfileId is not { } caller)
        {
            return [];
        }

        var mine = db.Contacts.AsNoTracking().Where(c => c.OwnerId == caller && c.ArchivedAtUtc == null);
        var contacts = await fullText.Match(mine, term).Take(limit).ToListAsync(cancellationToken);
        return [.. contacts.Select(c => new SearchHit(c.Id, c.Name, GlobalSearchHandler.Snippet(c.Organization, c.City), $"/contacts/{c.Id}"))];
    }
}

/// <summary>Partners, for leads, Staff and System Admin only (ADR 0014).</summary>
public class PartnerSearchSource(IApplicationDbContext db, IFullTextSearch fullText) : ISearchSource
{
    public SearchResultKind Kind => SearchResultKind.Partner;

    public async Task<IReadOnlyList<SearchHit>> SearchAsync(string term, SearchScope scope, int limit, CancellationToken cancellationToken = default)
    {
        if (!scope.Partners)
        {
            return [];
        }

        var partners = await fullText.Match(db.Partners.AsNoTracking(), term).Take(limit).ToListAsync(cancellationToken);
        return [.. partners.Select(p => new SearchHit(p.Id, p.Name, GlobalSearchHandler.Snippet("Partner", StageLabel(p.Stage), p.Offering), $"/partners/{p.Id}"))];
    }

    private static string StageLabel(PartnerStage stage) => stage switch
    {
        PartnerStage.InFunnel => "In funnel",
        _ => stage.ToString(),
    };
}

/// <summary>Active work items in active workspaces the caller owns or belongs to; Staff and System Admin see all (ADR 0011).</summary>
public class WorkItemSearchSource(IApplicationDbContext db, IFullTextSearch fullText) : ISearchSource
{
    public SearchResultKind Kind => SearchResultKind.WorkItem;

    public async Task<IReadOnlyList<SearchHit>> SearchAsync(string term, SearchScope scope, int limit, CancellationToken cancellationToken = default)
    {
        var workspaces = db.Workspaces.AsNoTracking().Where(w => !w.IsArchived);
        if (!scope.AllWorkspaces)
        {
            var caller = scope.CallerProfileId ?? Guid.Empty;
            workspaces = workspaces.Where(w => w.OwnerId == caller || w.Members.Any(m => m.ProfileId == caller));
        }

        var visible = workspaces.Select(w => w.Id);
        var items = db.WorkItems.AsNoTracking().Where(i => !i.IsArchived && visible.Contains(i.WorkspaceId));
        var found = await fullText.Match(items, term).Take(limit).ToListAsync(cancellationToken);
        var ids = found.Select(i => i.WorkspaceId).Distinct().ToList();
        var names = await db.Workspaces.Where(w => ids.Contains(w.Id)).ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
        return [.. found.Select(i => new SearchHit(
            i.Id,
            i.Title,
            GlobalSearchHandler.Snippet(i.Kind.ToString(), names.GetValueOrDefault(i.WorkspaceId), StatusLabel(i.Status)),
            $"/workspaces/{i.WorkspaceId}/items/{i.Id}"))];
    }

    private static string StatusLabel(WorkItemStatus status) => status switch
    {
        WorkItemStatus.ToDo => "To Do",
        WorkItemStatus.InProgress => "In Progress",
        _ => status.ToString(),
    };
}
