using System.Text.Json;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>A template as step 2 of the wizard lists it (L2-169 AC1, AC2): the section kinds it shows, in catalogue order.</summary>
public record HubTemplateDto(Guid Id, string Name, string Description, IReadOnlyList<string> Shown);

/// <summary>One section of a template, read from its JSON (ADR 0041).</summary>
public record HubTemplateSection(HubSectionKind Kind, bool Visible, JsonElement? Content);

/// <summary>Reads a template's sections; a kind the template doesn't name is hidden and has no content.</summary>
public static class HubTemplateSections
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    private sealed record Row(string? Kind, bool Visible, JsonElement? Content);

    public static IReadOnlyList<HubTemplateSection> Read(HubTemplate template)
    {
        var rows = JsonSerializer.Deserialize<List<Row>>(template.Sections, Options) ?? [];
        return
        [
            .. Enum.GetValues<HubSectionKind>().Select(kind =>
                rows.FirstOrDefault(r => EventHubRules.TryParseKind(r.Kind, out var k) && k == kind) is { } row
                    ? new HubTemplateSection(kind, row.Visible, row.Content is { ValueKind: JsonValueKind.Object } c ? c : null)
                    : new HubTemplateSection(kind, false, null)),
        ];
    }
}

/// <summary>Lists the organisation's templates in order (L2-169 AC2). Needs <c>ManageEventHubs</c> (403).</summary>
public class ListHubTemplatesHandler(IApplicationDbContext db, EventPermissions permissions)
{
    public async Task<(Result Result, IReadOnlyList<HubTemplateDto> Templates)> HandleAsync(CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageHubs)
        {
            return (Result.Forbidden(), []);
        }

        var templates = await db.HubTemplates.OrderBy(t => t.SortOrder).ThenBy(t => t.Name).ToListAsync(cancellationToken);
        return (Result.Ok(),
        [
            .. templates.Select(t => new HubTemplateDto(
                t.Id, t.Name, t.Description,
                [.. HubTemplateSections.Read(t).Where(s => s.Visible).Select(s => s.Kind.ToString())])),
        ]);
    }
}

/// <summary>A hub to copy (L2-170 AC2): its event's id, title and start.</summary>
public record PastEventHubDto(Guid EventId, string Title, DateTimeOffset StartsAt);

/// <summary>
/// The organisation's hubs for Copy a past hub (L2-170 AC2): by event title (case-insensitive), newest event first, at most 20,
/// without the event being started. Needs <c>ManageEventHubs</c>.
/// </summary>
public class ListEventHubsHandler(IApplicationDbContext db, EventPermissions permissions)
{
    public const int Limit = 20;

    public async Task<(Result Result, IReadOnlyList<PastEventHubDto> Hubs)> HandleAsync(
        string? search, Guid? excludeEventId, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageHubs)
        {
            return (Result.Forbidden(), []);
        }

        var text = search?.Trim().ToLower() ?? string.Empty;
        var hubs = await (from h in db.EventHubs
                          join e in db.Events on h.EventId equals e.Id
                          where e.Id != excludeEventId && (text == string.Empty || e.Title.ToLower().Contains(text))
                          orderby e.StartsAt descending
                          select new PastEventHubDto(e.Id, e.Title, e.StartsAt))
            .Take(Limit)
            .ToListAsync(cancellationToken);
        return (Result.Ok(), hubs);
    }
}
