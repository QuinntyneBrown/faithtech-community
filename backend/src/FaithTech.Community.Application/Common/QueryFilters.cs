namespace FaithTech.Community.Application.Common;

/// <summary>The names of the context's query filters, so a query lifts only the one it means to.</summary>
public static class QueryFilters
{
    /// <summary>Keeps every query inside the current organisation (ADR 0032). Never lifted by a request.</summary>
    public const string Organisation = "Organisation";

    /// <summary>Hides archived workspaces and work items (ADR 0011).</summary>
    public const string Archived = "Archived";

    /// <summary>
    /// Hides every chapter while chapters are off, so no profile, event or list shows one; the tags are kept and come
    /// back with the label (L2-140 AC2, AC6).
    /// </summary>
    public const string ChaptersOn = "ChaptersOn";

    /// <summary>Lift with <c>IgnoreQueryFilters(QueryFilters.ChaptersOnOnly)</c> to read chapters while they are off.</summary>
    public static readonly string[] ChaptersOnOnly = [ChaptersOn];

    /// <summary>Lift with <c>IgnoreQueryFilters(QueryFilters.ArchivedOnly)</c> to see archived records of this organisation.</summary>
    public static readonly string[] ArchivedOnly = [Archived];

    /// <summary>
    /// Lifts the organisation filter. Only <c>MeHandler</c> uses it, to list the caller's own memberships of other
    /// organisations by name and host (L2-132 AC3, L2-133 AC1); nothing else of another organisation is ever read.
    /// </summary>
    public static readonly string[] OrganisationOnly = [Organisation];
}
