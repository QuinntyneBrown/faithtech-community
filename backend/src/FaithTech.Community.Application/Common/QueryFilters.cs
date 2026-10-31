namespace FaithTech.Community.Application.Common;

/// <summary>The names of the context's query filters, so a query lifts only the one it means to.</summary>
public static class QueryFilters
{
    /// <summary>Keeps every query inside the current organisation (ADR 0032). Never lifted by a request.</summary>
    public const string Organisation = "Organisation";

    /// <summary>Hides archived workspaces and work items (ADR 0011).</summary>
    public const string Archived = "Archived";

    /// <summary>Lift with <c>IgnoreQueryFilters(QueryFilters.ArchivedOnly)</c> to see archived records of this organisation.</summary>
    public static readonly string[] ArchivedOnly = [Archived];
}
