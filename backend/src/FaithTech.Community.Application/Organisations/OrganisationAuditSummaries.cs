using System.Text.Json;
using FaithTech.Community.Domain.Admin;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// One line for each change to the organisation's settings, read from the entry's before and after values, such as
/// "Renamed Toronto to Toronto East" or "Defined the role Meet-up Lead" (L2-152 AC2).
/// </summary>
/// <param name="ChapterSingular">What the organisation calls one chapter, in lower case.</param>
/// <param name="ChapterPlural">What the organisation calls several chapters, in lower case.</param>
/// <param name="RoleNames">Every role definition's name by id, archived ones included.</param>
public sealed record OrganisationAuditSummaries(string ChapterSingular, string ChapterPlural, IReadOnlyDictionary<Guid, string> RoleNames)
{
    private static readonly Dictionary<string, (string One, string Many)> Lists = new()
    {
        ["partner-stages"] = ("partner stage", "partner stages"),
        ["event-types"] = ("event type", "event types"),
        ["resource-types"] = ("resource type", "resource types"),
    };

    /// <summary>The summary of a settings action, or null when the entry is not one.</summary>
    public string? Summarize(AuditEntry entry)
    {
        var before = Parse(entry.BeforeJson);
        var after = Parse(entry.AfterJson);
        return entry.Action switch
        {
            "organisation.updated" => Organisation(before, after),
            "chapter.added" => $"Added the {ChapterSingular} {Text(after, "Name")}",
            "chapter.updated" => $"Renamed {Text(before, "Name")} to {Text(after, "Name")}",
            "chapter.reordered" => $"Reordered the {ChapterPlural}",
            "chapter.archived" => $"Archived the {ChapterSingular} {Text(before, "Name")}",
            "role.defined" => $"Defined the role {Text(after, "Name")}",
            "role.updated" => Text(before, "Name") == Text(after, "Name")
                ? $"Edited the role {Text(after, "Name")}"
                : $"Renamed the role {Text(before, "Name")} to {Text(after, "Name")}",
            "role.archived" => $"Archived the role {Text(before, "Name")}",
            "role.grants.updated" => Grants(entry, before, after),
            "taxonomy.updated" => Taxonomy(before, after),
            _ => null,
        };
    }

    private string Organisation(JsonElement? before, JsonElement? after)
    {
        var clauses = new List<string>();
        if (Text(before, "Name") != Text(after, "Name"))
        {
            clauses.Add($"renamed the organisation from {Text(before, "Name")} to {Text(after, "Name")}");
        }

        if (Text(before, "ShortName") != Text(after, "ShortName"))
        {
            clauses.Add($"changed the short name from {Text(before, "ShortName")} to {Text(after, "ShortName")}");
        }

        var (singularBefore, pluralBefore) = (Text(before, "ChapterLabelSingular"), Text(before, "ChapterLabelPlural"));
        var (singular, plural) = (Text(after, "ChapterLabelSingular"), Text(after, "ChapterLabelPlural"));
        if (pluralBefore.Length == 0 && plural.Length > 0)
        {
            clauses.Add($"turned {plural.ToLowerInvariant()} on, called {singular} / {plural}");
        }
        else if (pluralBefore.Length > 0 && plural.Length == 0)
        {
            clauses.Add($"turned {pluralBefore.ToLowerInvariant()} off");
        }
        else if (singularBefore != singular || pluralBefore != plural)
        {
            clauses.Add($"renamed {pluralBefore.ToLowerInvariant()} to {singular} / {plural}");
        }

        if (clauses.Count == 0)
        {
            return "Saved the general settings";
        }

        var line = string.Join("; ", clauses);
        return char.ToUpperInvariant(line[0]) + line[1..];
    }

    private string Grants(AuditEntry entry, JsonElement? before, JsonElement? after)
    {
        var role = Guid.TryParse(entry.TargetId, out var id) ? RoleNames.GetValueOrDefault(id, "a role") : "a role";
        var was = Ids(before);
        var now = Ids(after);
        var changes = new List<string>();
        if (now.Except(was).ToList() is { Count: > 0 } added)
        {
            changes.Add($"added {Names(added)}");
        }

        if (was.Except(now).ToList() is { Count: > 0 } removed)
        {
            changes.Add($"removed {Names(removed)}");
        }

        return $"Changed who {role} may grant: {(changes.Count == 0 ? "no change" : string.Join("; ", changes))}";
    }

    private string Names(IEnumerable<Guid> ids) => string.Join(", ", ids.Select(id => RoleNames.GetValueOrDefault(id, "a role")));

    private static string Taxonomy(JsonElement? before, JsonElement? after)
    {
        var list = Text(after, "List");
        var (one, many) = Lists.GetValueOrDefault(list, ("item", "items"));
        var name = Text(after, "Name");
        if (after is { } value && !value.TryGetProperty("Name", out _))
        {
            return $"Reordered the {many}";
        }

        if (before is null)
        {
            return $"Added the {one} {name}";
        }

        if (!Flag(before, "Archived") && Flag(after, "Archived"))
        {
            return $"Archived the {one} {name}";
        }

        if (Text(before, "Name") != name)
        {
            return $"Renamed the {one} {Text(before, "Name")} to {name}";
        }

        if (!Flag(before, "IsInitial") && Flag(after, "IsInitial"))
        {
            return $"Set {name} as the initial partner stage";
        }

        if (Text(before, "Kind") != Text(after, "Kind"))
        {
            return $"Made {name} count as {Text(after, "Kind").ToLowerInvariant()}";
        }

        return $"Changed the {one} {name}";
    }

    private static JsonElement? Parse(string? json)
    {
        if (json is null)
        {
            return null;
        }

        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    private static string Text(JsonElement? element, string property) =>
        element is { ValueKind: JsonValueKind.Object } value && value.TryGetProperty(property, out var found) && found.ValueKind == JsonValueKind.String
            ? found.GetString()!
            : string.Empty;

    private static bool Flag(JsonElement? element, string property) =>
        element is { ValueKind: JsonValueKind.Object } value && value.TryGetProperty(property, out var found) && found.ValueKind == JsonValueKind.True;

    private static List<Guid> Ids(JsonElement? element) =>
        element is { ValueKind: JsonValueKind.Object } value
        && value.TryGetProperty("GrantableRoleIds", out var ids) && ids.ValueKind == JsonValueKind.Array
            ? [.. ids.EnumerateArray().Select(i => i.TryGetGuid(out var id) ? id : Guid.Empty)]
            : [];
}
