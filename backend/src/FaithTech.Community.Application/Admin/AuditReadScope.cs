using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Admin;

/// <summary>
/// Which part of the audit log a caller may read (L2-041 AC4, L2-152 AC3): an administrator reads everything; a holder
/// of ManageRoles reads the roles category and a holder of ManageOrganisationSettings the organisation, chapters and
/// taxonomies categories, the categories they may change.
/// </summary>
public sealed class AuditReadScope
{
    private AuditReadScope(bool everything, IReadOnlySet<string> categories) => (Everything, Categories) = (everything, categories);

    public bool Everything { get; }

    /// <summary>The categories a partial reader may read; empty for an administrator, who reads them all.</summary>
    public IReadOnlySet<string> Categories { get; }

    /// <summary>The caller's scope, or null when they may read none of the audit log.</summary>
    public static AuditReadScope? For(ICurrentUser current)
    {
        if (current.Has(Capability.AdministerOrganisation))
        {
            return new AuditReadScope(true, new HashSet<string>());
        }

        var categories = new HashSet<string>();
        if (current.Has(Capability.ManageRoles))
        {
            categories.Add(OrganisationAuditCategories.Roles);
        }

        if (current.Has(Capability.ManageOrganisationSettings))
        {
            categories.UnionWith([OrganisationAuditCategories.Organisation, OrganisationAuditCategories.Chapters, OrganisationAuditCategories.Taxonomies]);
        }

        return categories.Count == 0 ? null : new AuditReadScope(false, categories);
    }

    /// <summary>Whether the caller may ask for <paramref name="category"/>; no category means everything they may read.</summary>
    public bool Allows(string? category) => Everything || category is null || Categories.Contains(category);

    /// <summary>A partial reader's entries when no category is chosen: the union of their categories.</summary>
    public IQueryable<AuditEntry> Limit(IQueryable<AuditEntry> entries)
    {
        if (Everything)
        {
            return entries;
        }

        var organisation = Categories.Contains(OrganisationAuditCategories.Organisation);
        var roles = Categories.Contains(OrganisationAuditCategories.Roles);
        var chapters = Categories.Contains(OrganisationAuditCategories.Chapters);
        var taxonomies = Categories.Contains(OrganisationAuditCategories.Taxonomies);
        return entries.Where(e =>
            (organisation && e.Action == "organisation.updated")
            || (roles && e.Action.StartsWith("role."))
            || (chapters && e.Action.StartsWith("chapter."))
            || (taxonomies && e.Action == "taxonomy.updated"));
    }
}
