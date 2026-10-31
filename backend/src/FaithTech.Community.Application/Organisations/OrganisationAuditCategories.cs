using FaithTech.Community.Domain.Admin;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// The audit categories of the organisation's settings and the actions each holds (L2-152 AC1, AC2). The role
/// changes of L2-041 share <see cref="Roles"/>: every action starting <c>role.</c> belongs to it.
/// </summary>
public static class OrganisationAuditCategories
{
    public const string Organisation = "organisation";
    public const string Roles = "roles";
    public const string Chapters = "chapters";
    public const string Taxonomies = "taxonomies";

    /// <summary>The entries of a settings category, or null when <paramref name="category"/> is not one.</summary>
    public static IQueryable<AuditEntry>? Filter(IQueryable<AuditEntry> entries, string category) => category switch
    {
        Organisation => entries.Where(e => e.Action == "organisation.updated"),
        Roles => entries.Where(e => e.Action.StartsWith("role.")),
        Chapters => entries.Where(e => e.Action.StartsWith("chapter.")),
        Taxonomies => entries.Where(e => e.Action == "taxonomy.updated"),
        _ => null,
    };
}
