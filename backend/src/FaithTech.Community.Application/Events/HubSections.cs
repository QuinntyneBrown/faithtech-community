using System.Text.Json;
using System.Text.RegularExpressions;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

// Each phase 1 section kind's content: only what the lead types (ADR 0038). Values another feature owns are read live.

public record HeroContent(string? Subtitle);

public record AgendaItem(DateTimeOffset? StartsAt, string? Title, string? Detail);

public record AgendaContent(IReadOnlyList<AgendaItem>? Items);

public record VenueContent(string? Directions);

/// <summary>A member (by profile id only) or a guest (name and line, kept on the hub only), with their role on the day.</summary>
public record HubPerson(Guid? ProfileId, string? Name, string? Line, string? Role);

public record PeopleContent(IReadOnlyList<HubPerson>? People);

public record LinksContent(string? SubmissionUrl, string? FeedbackUrl, DateTimeOffset? CodeFreezeAt);

public record GivingContent(string? Line);

public record UpcomingEventsContent(int? Count);

/// <summary>The new order of a hub's sections (L2-156 AC4).</summary>
public record ReorderHubSectionsCommand(IReadOnlyList<string>? Kinds);

public class ReorderHubSectionsValidator : AbstractValidator<ReorderHubSectionsCommand>
{
    public ReorderHubSectionsValidator()
    {
        RuleFor(x => x.Kinds)
            .Must(k => k is not null && k.All(v => EventHubRules.TryParseKind(v, out _))
                && k.Select(v => v.ToLowerInvariant()).Distinct().Count() == k.Count
                && k.Count == Enum.GetValues<HubSectionKind>().Length)
            .WithMessage("Choose sections from the list.");
    }
}

public class HeroContentValidator : AbstractValidator<HeroContent>
{
    public HeroContentValidator() =>
        RuleFor(x => x.Subtitle).MaximumLength(HubContent.MaxSubtitle).WithMessage("Use 140 characters or fewer.");
}

public class AgendaContentValidator : AbstractValidator<AgendaContent>
{
    public AgendaContentValidator()
    {
        RuleFor(x => x.Items).Must(i => i is null || i.Count <= HubContent.MaxAgendaRows).WithMessage("You can add up to 40 rows.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.StartsAt).NotNull().WithMessage("Enter a time.");
            item.RuleFor(i => i.Title).Cascade(CascadeMode.Stop)
                .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Say what’s happening.")
                .Must(t => t!.Trim().Length <= 100).WithMessage("Use 100 characters or fewer.");
            item.RuleFor(i => i.Detail).Must(d => d is null || d.Trim().Length <= 200).WithMessage("Use 200 characters or fewer.");
        }).When(x => x.Items is null || x.Items.Count <= HubContent.MaxAgendaRows);
    }
}

public class VenueContentValidator : AbstractValidator<VenueContent>
{
    public VenueContentValidator() =>
        RuleFor(x => x.Directions).Must(d => d is null || d.Trim().Length <= 500).WithMessage("Use 500 characters or fewer.");
}

public class PeopleContentValidator : AbstractValidator<PeopleContent>
{
    public PeopleContentValidator()
    {
        RuleFor(x => x.People).Must(p => p is null || p.Count <= HubContent.MaxPeople).WithMessage("You can add up to 60 people.");
        RuleForEach(x => x.People).ChildRules(person =>
        {
            person.RuleFor(p => p.Name).Cascade(CascadeMode.Stop)
                .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Enter their name.")
                .Must(n => n!.Trim().Length <= 80).WithMessage("Use 80 characters or fewer.")
                .When(p => p.ProfileId is null);
            person.RuleFor(p => p.Line).Must(l => l is null || l.Trim().Length <= 120).WithMessage("Use 120 characters or fewer.")
                .When(p => p.ProfileId is null);
            person.RuleFor(p => p.Role).Must(r => HubContent.Roles.Contains(r ?? string.Empty, StringComparer.OrdinalIgnoreCase))
                .WithMessage("Choose mentor, judge or speaker.");
        }).When(x => x.People is null || x.People.Count <= HubContent.MaxPeople);
    }
}

public class LinksContentValidator : AbstractValidator<LinksContent>
{
    public LinksContentValidator()
    {
        RuleFor(x => x.SubmissionUrl).Must(HubContent.IsHttpsOrEmpty).WithMessage(HubContent.HttpsMessage);
        RuleFor(x => x.FeedbackUrl).Must(HubContent.IsHttpsOrEmpty).WithMessage(HubContent.HttpsMessage);
    }
}

public class GivingContentValidator : AbstractValidator<GivingContent>
{
    public GivingContentValidator() =>
        RuleFor(x => x.Line).Must(l => l is null || l.Trim().Length <= 200).WithMessage("Use 200 characters or fewer.");
}

public class UpcomingEventsContentValidator : AbstractValidator<UpcomingEventsContent>
{
    public UpcomingEventsContentValidator() =>
        RuleFor(x => x.Count).InclusiveBetween(1, 6).WithMessage("Choose between 1 and 6.").When(x => x.Count is not null);
}

/// <summary>The per-kind schemas: parsing, validation, normalising and the Ready rule (L2-156 AC2, L2-157 AC3, ADR 0038).</summary>
public static partial class HubContent
{
    public const int MaxSubtitle = 140;
    public const int MaxAgendaRows = 40;
    public const int MaxPeople = 60;
    public const int DefaultUpcoming = 3;
    public const string HttpsMessage = "Use a link that starts with https://";

    public static readonly string[] Roles = ["Mentor", "Judge", "Speaker"];

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static bool IsHttpsOrEmpty(string? link) =>
        string.IsNullOrWhiteSpace(link)
        || (link.Trim().Length <= 500 && Uri.TryCreate(link.Trim(), UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps);

    public static Type ContentType(HubSectionKind kind) => kind switch
    {
        HubSectionKind.Hero => typeof(HeroContent),
        HubSectionKind.Agenda => typeof(AgendaContent),
        HubSectionKind.Venue => typeof(VenueContent),
        HubSectionKind.People => typeof(PeopleContent),
        HubSectionKind.Links => typeof(LinksContent),
        HubSectionKind.Giving => typeof(GivingContent),
        HubSectionKind.UpcomingEvents => typeof(UpcomingEventsContent),
        _ => throw new ArgumentOutOfRangeException(nameof(kind)),
    };

    private static IValidator Validator(HubSectionKind kind) => kind switch
    {
        HubSectionKind.Hero => new HeroContentValidator(),
        HubSectionKind.Agenda => new AgendaContentValidator(),
        HubSectionKind.Venue => new VenueContentValidator(),
        HubSectionKind.People => new PeopleContentValidator(),
        HubSectionKind.Links => new LinksContentValidator(),
        HubSectionKind.Giving => new GivingContentValidator(),
        HubSectionKind.UpcomingEvents => new UpcomingEventsContentValidator(),
        _ => throw new ArgumentOutOfRangeException(nameof(kind)),
    };

    /// <summary>Reads stored content; anything unreadable reads as the kind's defaults.</summary>
    public static T Read<T>(string? content)
        where T : class
    {
        try
        {
            return JsonSerializer.Deserialize<T>(string.IsNullOrWhiteSpace(content) ? "{}" : content, Json)
                ?? JsonSerializer.Deserialize<T>("{}", Json)!;
        }
        catch (JsonException)
        {
            return JsonSerializer.Deserialize<T>("{}", Json)!;
        }
    }

    /// <summary>
    /// Deserialises a request body into the kind's record and validates it: the content to store, or the errors keyed by field
    /// path in camel case (<c>items[2].title</c>).
    /// </summary>
    public static (object? Content, IReadOnlyDictionary<string, string[]>? Errors) Parse(HubSectionKind kind, JsonElement body)
    {
        object? content;
        try
        {
            content = body.ValueKind == JsonValueKind.Object ? body.Deserialize(ContentType(kind), Json) : null;
        }
        catch (JsonException)
        {
            content = null;
        }

        if (content is null)
        {
            return (null, new Dictionary<string, string[]> { ["content"] = ["Check this section’s fields."] });
        }

        var result = Validator(kind).Validate(new ValidationContext<object>(content));
        return result.IsValid ? (Normalise(content), null) : (null, Errors(result));
    }

    public static IReadOnlyDictionary<string, string[]> Errors(ValidationResult result) =>
        result.Errors.GroupBy(e => CamelPath(e.PropertyName))
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray());

    private static string CamelPath(string path) =>
        string.Join('.', path.Split('.').Select(segment => segment.Length == 0 ? segment : char.ToLowerInvariant(segment[0]) + segment[1..]));

    /// <summary>Trims text, drops empty text and keeps only what the kind stores (members keep only their id and role).</summary>
    private static object Normalise(object content) => content switch
    {
        HeroContent c => new HeroContent(Text(c.Subtitle)),
        AgendaContent c => new AgendaContent([.. (c.Items ?? []).Select(i => new AgendaItem(i.StartsAt, Text(i.Title), Text(i.Detail)))]),
        VenueContent c => new VenueContent(Text(c.Directions)),
        PeopleContent c => new PeopleContent([.. (c.People ?? []).Select(p => p.ProfileId is { } id
            ? new HubPerson(id, null, null, Role(p.Role))
            : new HubPerson(null, Text(p.Name), Text(p.Line), Role(p.Role)))]),
        LinksContent c => new LinksContent(Text(c.SubmissionUrl), Text(c.FeedbackUrl), c.CodeFreezeAt),
        GivingContent c => new GivingContent(Text(c.Line)),
        UpcomingEventsContent c => new UpcomingEventsContent(c.Count),
        _ => content,
    };

    private static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : WhiteSpace().Replace(value.Trim(), " ");

    private static string Role(string? role) => Roles.First(r => string.Equals(r, role, StringComparison.OrdinalIgnoreCase));

    [GeneratedRegex(@"[ \t]+")]
    private static partial Regex WhiteSpace();

    /// <summary>
    /// Hidden when not shown; otherwise Ready when the section has what visitors need (L2-156 AC2): Hero and Upcoming events
    /// always; Agenda with a row; Venue for an in-person event with a venue; People with a person; Submission and feedback
    /// with a link; Giving when the organisation has a giving link. Needs info otherwise.
    /// </summary>
    public static string State(HubSection section, Event e, Organisation organisation)
    {
        if (!section.Visible)
        {
            return "Hidden";
        }

        var ready = section.Kind switch
        {
            HubSectionKind.Hero or HubSectionKind.UpcomingEvents => true,
            HubSectionKind.Agenda => Read<AgendaContent>(section.Content).Items is { Count: > 0 },
            HubSectionKind.Venue => e.Format == EventFormat.InPerson && !string.IsNullOrWhiteSpace(e.Venue),
            HubSectionKind.People => Read<PeopleContent>(section.Content).People is { Count: > 0 },
            HubSectionKind.Links => Read<LinksContent>(section.Content) is var l && (l.SubmissionUrl is not null || l.FeedbackUrl is not null),
            HubSectionKind.Giving => organisation.GivingLink is not null,
            _ => false,
        };
        return ready ? "Ready" : "NeedsInfo";
    }
}

/// <summary>
/// Saves one section's content (L2-157 AC2, AC3, AC5, AC6): validated against its kind's schema, then checked against the
/// database (members of this organisation, a code freeze that is an agenda row's time). Audited on override.
/// </summary>
public class SaveHubSectionHandler(IApplicationDbContext db, EventPermissions permissions, IAuditLog audit, TimeProvider time)
{
    public async Task<Result> HandleAsync(Guid eventId, string kindName, JsonElement body, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageHubs || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return Result.Forbidden();
        }

        var hub = await db.EventHubs.Include(h => h.Sections).SingleOrDefaultAsync(h => h.EventId == eventId, cancellationToken);
        if (hub is null || !EventHubRules.TryParseKind(kindName, out var kind) || !await db.Events.AnyAsync(e => e.Id == eventId, cancellationToken))
        {
            return Result.NotFound();
        }

        var (content, errors) = HubContent.Parse(kind, body);
        if (errors is not null)
        {
            return new Result(ResultStatus.Invalid, errors);
        }

        if (await CheckAsync(hub, content!, cancellationToken) is { } refusal)
        {
            return refusal;
        }

        var json = JsonSerializer.Serialize(content, HubContent.ContentType(kind), HubContent.Json);
        hub.FillSection(kind, json, time.GetUtcNow());
        if (permissions.IsHubOverride)
        {
            audit.Record(actor, "event_hub.updated", "EventHub", hub.Id.ToString(), null, new { Section = kind.ToString() });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private async Task<Result?> CheckAsync(EventHub hub, object content, CancellationToken cancellationToken)
    {
        switch (content)
        {
            case PeopleContent people:
                var ids = people.People!.Where(p => p.ProfileId is not null).Select(p => p.ProfileId!.Value).Distinct().ToList();
                var known = await db.Profiles.Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync(cancellationToken);
                var unknown = people.People!.Select((p, i) => (p, i)).FirstOrDefault(x => x.p.ProfileId is { } id && !known.Contains(id));
                return unknown.p is null ? null : Result.Invalid($"people[{unknown.i}].profileId", "Choose a member from the search.");
            case LinksContent { CodeFreezeAt: { } freeze }:
                var agenda = HubContent.Read<AgendaContent>(hub.Sections.Single(s => s.Kind == HubSectionKind.Agenda).Content);
                return (agenda.Items ?? []).Any(i => i.StartsAt == freeze)
                    ? null
                    : Result.Invalid("codeFreezeAt", "Pick a time from the agenda.");
            default:
                return null;
        }
    }
}

/// <summary>Puts a hub's sections in a new order (L2-156 AC4). Audited on override.</summary>
public class ReorderHubSectionsHandler(IApplicationDbContext db, EventPermissions permissions, IAuditLog audit, TimeProvider time)
{
    public async Task<Result> HandleAsync(Guid eventId, ReorderHubSectionsCommand command, CancellationToken cancellationToken = default)
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

        var kinds = command.Kinds!.Select(k =>
        {
            EventHubRules.TryParseKind(k, out var kind);
            return kind;
        }).ToList();
        hub.Reorder(kinds, time.GetUtcNow());
        if (permissions.IsHubOverride)
        {
            audit.Record(actor, "event_hub.updated", "EventHub", hub.Id.ToString(), null, new { Order = command.Kinds });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
