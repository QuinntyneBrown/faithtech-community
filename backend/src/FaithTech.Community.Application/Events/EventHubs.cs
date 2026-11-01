using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Events;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>The event's facts as the hub shows them, read from the event on every request (L2-154 AC3, ADR 0036).</summary>
public record HubEventFactsDto(
    string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Format, string? Venue, string? OnlineLink, string RsvpLink,
    bool IsCancelled);

/// <summary>
/// A section on the hub home: its kind, whether it is shown, its state (L2-156 AC2) and its content as the display
/// components read it (ADR 0038): the kind's record, with People members resolved to their current name and photo.
/// </summary>
public record HubSectionDto(string Kind, bool Visible, string State, object? Content = null);

/// <summary>A person on the People section as visitors see them; a member's name and photo are read from their profile.</summary>
public record HubPersonDto(Guid? ProfileId, string Name, string? Line, string Role, string? PhotoUrl);

public record HubPeopleDto(IReadOnlyList<HubPersonDto> People);

/// <summary>The organisation's facts the hub shows (L2-158): its names and its giving link and text.</summary>
public record HubOrganisationDto(string Name, string ShortName, string? GivingLink, string? GivingText);

/// <summary>One of the chapter's next public events (L2-162 AC2).</summary>
public record HubUpcomingEventDto(
    Guid Id, string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Format, string? Venue, string? ChapterName);

/// <summary>A hub as its home shows it (L2-154 AC1), sections in order.</summary>
public record EventHubDto(
    Guid Id, Guid EventId, string Status, string TemplateKey, string Link, HubEventFactsDto Event, IReadOnlyList<HubSectionDto> Sections,
    HubOrganisationDto? Organisation = null, IReadOnlyList<HubUpcomingEventDto>? UpcomingEvents = null);

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

/// <summary>
/// Reads an event's hub for its home (L2-154, L2-156): the facts come from the event, the organisation and Profiles, the
/// section states and the upcoming events are computed, and nothing another feature owns is copied (ADR 0038).
/// </summary>
public class GetEventHubHandler(
    IApplicationDbContext db, EventPermissions permissions, ICurrentOrganisation organisation, IPhotoStorage photos, TimeProvider time)
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

        var org = await db.Organisations.AsNoTracking().SingleAsync(o => o.Id == organisation.Id, cancellationToken);
        var origin = organisation.Origin;
        var facts = new HubEventFactsDto(
            e.Title, e.StartsAt, e.EndsAt, e.Format.ToString(), e.Venue, e.OnlineLink, $"{origin}/public/events/{e.Id}", e.IsCancelled);
        var sections = new List<HubSectionDto>();
        foreach (var s in hub.Sections.OrderBy(s => s.Order))
        {
            sections.Add(new HubSectionDto(s.Kind.ToString(), s.Visible, HubContent.State(s, e, org), await ContentAsync(s, cancellationToken)));
        }

        var count = HubContent.Read<UpcomingEventsContent>(hub.Sections.Single(s => s.Kind == HubSectionKind.UpcomingEvents).Content).Count
            ?? HubContent.DefaultUpcoming;
        return (Result.Ok(), new EventHubDto(
            hub.Id, e.Id, hub.Status.ToString(), hub.TemplateKey, $"{origin}{EventHubRules.Path(e.Id)}", facts, sections,
            new HubOrganisationDto(org.Name, org.ShortName, org.GivingLink, org.GivingText),
            await UpcomingAsync(e, count, cancellationToken)));
    }

    private async Task<object> ContentAsync(HubSection section, CancellationToken cancellationToken) => section.Kind switch
    {
        HubSectionKind.Hero => HubContent.Read<HeroContent>(section.Content),
        HubSectionKind.Agenda => new AgendaContent(HubContent.Read<AgendaContent>(section.Content).Items ?? []),
        HubSectionKind.Venue => HubContent.Read<VenueContent>(section.Content),
        HubSectionKind.People => await PeopleAsync(HubContent.Read<PeopleContent>(section.Content), cancellationToken),
        HubSectionKind.Links => HubContent.Read<LinksContent>(section.Content),
        HubSectionKind.Giving => HubContent.Read<GivingContent>(section.Content),
        HubSectionKind.UpcomingEvents => new UpcomingEventsContent(
            HubContent.Read<UpcomingEventsContent>(section.Content).Count ?? HubContent.DefaultUpcoming),
        _ => new { },
    };

    /// <summary>Members are read from Profiles each time; a profile that no longer exists here drops out (L2-161 AC2).</summary>
    private async Task<HubPeopleDto> PeopleAsync(PeopleContent content, CancellationToken cancellationToken)
    {
        var people = content.People ?? [];
        var ids = people.Where(p => p.ProfileId is not null).Select(p => p.ProfileId!.Value).Distinct().ToList();
        var profiles = await db.Profiles.AsNoTracking().Include(p => p.Photos)
            .Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, cancellationToken);
        var shown = new List<HubPersonDto>();
        foreach (var person in people)
        {
            if (person.ProfileId is { } id)
            {
                if (profiles.TryGetValue(id, out var profile))
                {
                    var photo = profile.Photos.FirstOrDefault(p => p.IsFeatured);
                    shown.Add(new HubPersonDto(id, profile.Name, null, person.Role!, photo is null ? null : photos.GetReadUrl(photo.BlobName)));
                }
            }
            else
            {
                shown.Add(new HubPersonDto(null, person.Name!, person.Line, person.Role!, null));
            }
        }

        return new HubPeopleDto(shown);
    }

    /// <summary>
    /// The next public, not cancelled events after now in the event's chapter, or across the organisation for an
    /// organisation-wide event, excluding this one, earliest first (L2-162 AC2).
    /// </summary>
    private async Task<IReadOnlyList<HubUpcomingEventDto>> UpcomingAsync(Event e, int count, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        var query = db.Events.AsNoTracking().Include(x => x.Chapter)
            .Where(x => x.Id != e.Id && x.Visibility == EventVisibility.Public && !x.IsCancelled && x.StartsAt > now);
        if (e.ChapterId is { } chapter)
        {
            query = query.Where(x => x.ChapterId == chapter);
        }

        var events = await query.OrderBy(x => x.StartsAt).Take(count).ToListAsync(cancellationToken);
        return [.. events.Select(x => new HubUpcomingEventDto(
            x.Id, x.Title, x.StartsAt, x.EndsAt, x.Format.ToString(), x.Venue, x.Chapter?.Name))];
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
