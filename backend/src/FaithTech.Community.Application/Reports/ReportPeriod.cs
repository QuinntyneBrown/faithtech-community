namespace FaithTech.Community.Application.Reports;

/// <summary>A report window, inclusive at both ends; <see cref="From"/> is null for All time (ADR 0026).</summary>
public record ReportWindow(string Key, DateTimeOffset? From, DateTimeOffset To);

/// <summary>The four report periods and their URL keys (L2-099 AC3); windows and months are UTC.</summary>
public static class ReportPeriod
{
    public const string Last30Days = "last-30-days";
    public const string Last90Days = "last-90-days";
    public const string ThisYear = "this-year";
    public const string AllTime = "all-time";

    public const string Default = Last30Days;

    /// <summary>The window for a key, or null for an unknown key; an empty key is the default.</summary>
    public static ReportWindow? Resolve(string? key, TimeProvider time)
    {
        var now = time.GetUtcNow();
        key = string.IsNullOrEmpty(key) ? Default : key;
        DateTimeOffset? from = key switch
        {
            Last30Days => now.AddDays(-30),
            Last90Days => now.AddDays(-90),
            ThisYear => new DateTimeOffset(now.Year, 1, 1, 0, 0, 0, TimeSpan.Zero),
            AllTime => null,
            _ => DateTimeOffset.MinValue,
        };
        return from == DateTimeOffset.MinValue ? null : new ReportWindow(key, from, now);
    }

    /// <summary>"last 30 days", as the page and the CSV write it after "in the".</summary>
    public static string Describe(string key) => key switch
    {
        Last30Days => "last 30 days",
        Last90Days => "last 90 days",
        ThisYear => "this year",
        _ => "all time",
    };
}
