using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Events;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>The event's facts as the hub shows them, read from the event on every request (L2-154 AC3, ADR 0036).</summary>
public record HubEventFactsDto(
    string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Format, string? Venue, string? OnlineLink, string RsvpLink,
    bool IsCancelled);

/// <summary>A section on the hub home: its kind, whether it is shown and its state (L2-154 AC2).</summary>
public record HubSectionDto(string Kind, bool Visible, string State);

/// <summary>A hub as its home shows it (L2-154 AC1), sections in order.</summary>
public record EventHubDto(
    Guid Id, Guid EventId, string Status, string TemplateKey, string Link, HubEventFactsDto Event, IReadOnlyList<HubSectionDto> Sections);

public record HubSectionVisibility(string? Kind, bool Visible);

/// <summary>What the Create event hub wizard saves on every Next and on Save and finish later (L2-153 AC5, AC7).</summary>
public record SaveEventHubCommand(string? TemplateKey, IReadOnlyList<HubSectionVisibility>? Sections);

public class SaveEventHubValidator : AbstractValidator<SaveEventHubCommand>
{
    public SaveEventHubValidator()
    {
        // Only Blank until templates arrive (slice 45, L2-155 AC5).
        RuleFor(x => x.TemplateKey)
            .Must(k => k == EventHub.BlankTemplate).WithMessage("Choose a starting point from the list.");
        RuleFor(x => x.Sections)
            .Must(s => s is null || (s.All(v => EventHubRules.TryParseKind(v.Kind, out _))
                && s.Select(v => v.Kind!.ToLowerInvariant()).Distinct().Count() == s.Count))
            .WithMessage("Choose sections from the list.");
    }
}

/// <summary>The hub rules the handlers share.</summary>
public static class EventHubRules
{
    public static string Path(Guid eventId) => $"/public/events/{eventId}/hub";

    public static bool TryParseKind(string? kind, out HubSectionKind parsed) =>
        Enum.TryParse(kind, ignoreCase: true, out parsed) && Enum.IsDefined(parsed) && !int.TryParse(kind, out _);

    /// <summary>
    /// Hidden when not shown; Ready for the kinds the system fills (Hero, Giving, Upcoming events) and for Venue when the
    /// event is in person with a venue; Needs info otherwise (L2-154 AC2).
    /// </summary>
    public static string State(HubSection section, Event e) =>
        !section.Visible ? "Hidden"
        : section.Kind is HubSectionKind.Hero or HubSectionKind.Giving or HubSectionKind.UpcomingEvents ? "Ready"
        : section.Kind == HubSectionKind.Venue && e.Format == EventFormat.InPerson && !string.IsNullOrWhiteSpace(e.Venue) ? "Ready"
        : "NeedsInfo";
}

/// <summary>Starts an event's hub (L2-153 AC3, AC9; L2-155 AC2, AC4, AC5): a Draft from Blank with every section shown.</summary>
public class CreateEventHubHandler(IApplicationDbContext db, EventPermissions permissions, IAuditLog audit, TimeProvider time)
{
    public async Task<(Result Result, Guid Id)> HandleAsync(Guid eventId, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageHubs || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return (Result.Forbidden(), Guid.Empty);
        }

        var e = await db.Events.AsNoTracking().SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);
        if (e is null)
        {
            return (Result.NotFound(), Guid.Empty);
        }

        if (e.IsCancelled)
        {
            return (Result.Conflict("This event is cancelled, so it can’t have a hub."), Guid.Empty);
        }

        if (await db.EventHubs.AnyAsync(h => h.EventId == eventId, cancellationToken))
        {
            return (Result.Conflict("This event already has a hub."), Guid.Empty);
        }

        var hub = EventHub.CreateBlank(eventId, time.GetUtcNow());
        db.EventHubs.Add(hub);
        if (permissions.IsHubOverride)
        {
            audit.Record(actor, "event_hub.created", "EventHub", hub.Id.ToString(), null, new { EventId = eventId });
        }

        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), hub.Id);
    }
}

/// <summary>Reads an event's hub for its home (L2-154): the facts come from the event, the section states are computed.</summary>
public class GetEventHubHandler(IApplicationDbContext db, EventPermissions permissions, ICurrentOrganisation organisation)
{
    public async Task<(Result Result, EventHubDto? Hub)> HandleAsync(Guid eventId, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageHubs)
        {
            return (Result.Forbidden(), null);
        }

        var e = await db.Events.AsNoTracking().SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);
        var hub = e is null
            ? null
            : await db.EventHubs.AsNoTracking().Include(h => h.Sections).SingleOrDefaultAsync(h => h.EventId == eventId, cancellationToken);
        if (e is null || hub is null)
        {
            return (Result.NotFound(), null);
        }

        var origin = organisation.Origin;
        var facts = new HubEventFactsDto(
            e.Title, e.StartsAt, e.EndsAt, e.Format.ToString(), e.Venue, e.OnlineLink, $"{origin}/public/events/{e.Id}", e.IsCancelled);
        var sections = hub.Sections.OrderBy(s => s.Order)
            .Select(s => new HubSectionDto(s.Kind.ToString(), s.Visible, EventHubRules.State(s, e))).ToList();
        return (Result.Ok(), new EventHubDto(
            hub.Id, e.Id, hub.Status.ToString(), hub.TemplateKey, $"{origin}{EventHubRules.Path(e.Id)}", facts, sections));
    }
}

/// <summary>Saves the wizard's answers to a hub (L2-153 AC5, AC7): the starting point and section visibility.</summary>
public class SaveEventHubHandler(IApplicationDbContext db, EventPermissions permissions, IAuditLog audit, TimeProvider time)
{
    public async Task<Result> HandleAsync(Guid eventId, SaveEventHubCommand command, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageHubs || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return Result.Forbidden();
        }

        var hub = await db.EventHubs.Include(h => h.Sections).SingleOrDefaultAsync(h => h.EventId == eventId, cancellationToken);
        if (hub is null || !await db.Events.AnyAsync(e => e.Id == eventId, cancellationToken))
        {
            return Result.NotFound();
        }

        var visibility = new Dictionary<HubSectionKind, bool>();
        foreach (var section in command.Sections ?? [])
        {
            EventHubRules.TryParseKind(section.Kind, out var kind);
            visibility[kind] = section.Visible;
        }

        hub.Save(command.TemplateKey!, visibility, time.GetUtcNow());
        if (permissions.IsHubOverride)
        {
            audit.Record(actor, "event_hub.updated", "EventHub", hub.Id.ToString(), null, new { command.TemplateKey, command.Sections });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
