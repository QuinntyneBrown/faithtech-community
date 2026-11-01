using System.Text.Json;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>Step 2's choice (L2-169 AC3): a template, a hub to copy, or neither for Blank.</summary>
public record StartEventHubCommand(Guid? TemplateId, Guid? CopyFromEventId);

/// <summary>
/// Applies a starting point to an event's hub (L2-169, ADR 0041), replacing every section's place, visibility and content.
/// Needs <c>ManageEventHubs</c> (403); an event without a hub, or of another organisation, is 404; a template the organisation
/// doesn't have is 400. Audited as <c>event_hub.started</c>. Answers the hub as the hub home reads it.
/// </summary>
public class StartEventHubHandler(
    IApplicationDbContext db,
    EventPermissions permissions,
    IAuditLog audit,
    TimeProvider time,
    GetEventHubHandler reader)
{
    public const string UnknownTemplate = "Choose a starting point from the list.";

    public const string UnknownCopy = "Choose a hub to copy.";

    private sealed record TemplateAgendaRow(int Minutes, string? Title, string? Detail);

    private sealed record TemplateAgenda(IReadOnlyList<TemplateAgendaRow>? Items);

    public async Task<(Result Result, EventHubDto? Hub)> HandleAsync(
        Guid eventId, StartEventHubCommand command, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageHubs || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return (Result.Forbidden(), null);
        }

        var e = await db.Events.SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);
        var hub = await db.EventHubs.Include(h => h.Sections).SingleOrDefaultAsync(h => h.EventId == eventId, cancellationToken);
        if (e is null || hub is null)
        {
            return (Result.NotFound(), null);
        }

        string key;
        IReadOnlyList<HubSectionStart> sections;
        if (command.TemplateId is { } templateId)
        {
            var template = await db.HubTemplates.SingleOrDefaultAsync(t => t.Id == templateId, cancellationToken);
            if (template is null)
            {
                return (Result.Invalid("templateId", UnknownTemplate), null);
            }

            key = template.Id.ToString();
            sections = [.. HubTemplateSections.Read(template).Select(s => new HubSectionStart(s.Kind, s.Visible, Content(s, e.StartsAt)))];
        }
        else if (command.CopyFromEventId is { } fromId)
        {
            var source = fromId == eventId ? null : await db.Events.SingleOrDefaultAsync(x => x.Id == fromId, cancellationToken);
            var from = source is null ? null
                : await db.EventHubs.Include(h => h.Sections).SingleOrDefaultAsync(h => h.EventId == fromId, cancellationToken);
            if (source is null || from is null)
            {
                return (Result.Invalid("copyFromEventId", UnknownCopy), null);
            }

            key = EventHub.CopyTemplate;
            var shift = e.StartsAt - source.StartsAt;
            sections = [.. from.Sections.OrderBy(s => s.Order).Select(s => new HubSectionStart(s.Kind, s.Visible, Shifted(s, shift)))];
        }
        else
        {
            key = EventHub.BlankTemplate;
            sections = [.. Enum.GetValues<HubSectionKind>().Select(kind => new HubSectionStart(kind, true, null))];
        }

        hub.Start(key, sections, time.GetUtcNow());
        audit.Record(actor, "event_hub.started", "EventHub", hub.Id.ToString(), null, new { TemplateKey = key, Override = permissions.IsHubOverride });
        await db.SaveChangesAsync(cancellationToken);
        return await reader.HandleAsync(eventId, cancellationToken);
    }

    /// <summary>A copied section's content, with its Agenda times and code freeze moved by the shift (L2-170 AC4).</summary>
    private static string Shifted(HubSection section, TimeSpan shift)
    {
        switch (section.Kind)
        {
            case HubSectionKind.Agenda:
                var agenda = JsonSerializer.Deserialize<AgendaContent>(section.Content, HubContent.Json);
                if (agenda?.Items is { } items)
                {
                    return JsonSerializer.Serialize(new AgendaContent([.. items.Select(i => i with { StartsAt = i.StartsAt + shift })]), HubContent.Json);
                }

                break;
            case HubSectionKind.Links:
                var links = JsonSerializer.Deserialize<LinksContent>(section.Content, HubContent.Json);
                if (links?.CodeFreezeAt is not null)
                {
                    return JsonSerializer.Serialize(links with { CodeFreezeAt = links.CodeFreezeAt + shift }, HubContent.Json);
                }

                break;
        }

        return section.Content;
    }

    /// <summary>A template's default in the kind's own shape; an Agenda row's minutes become the event's start plus them.</summary>
    private static string? Content(HubTemplateSection section, DateTimeOffset startsAt)
    {
        if (section.Content is not { } content)
        {
            return null;
        }

        if (section.Kind == HubSectionKind.Agenda)
        {
            var rows = content.Deserialize<TemplateAgenda>(HubContent.Json)?.Items ?? [];
            var agenda = new AgendaContent([.. rows.Select(r => new AgendaItem(startsAt.AddMinutes(r.Minutes), r.Title, r.Detail))]);
            return JsonSerializer.Serialize(agenda, HubContent.Json);
        }

        var type = HubContent.ContentType(section.Kind);
        return JsonSerializer.Serialize(content.Deserialize(type, HubContent.Json), type, HubContent.Json);
    }
}
