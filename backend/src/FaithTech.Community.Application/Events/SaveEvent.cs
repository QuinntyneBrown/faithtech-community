using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Notifications;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>
/// The event form's fields, for both create and edit (L2-020). Type, format and visibility are enum names;
/// the venue is kept only for in-person events and the link only for online ones.
/// </summary>
public record SaveEventCommand(
    string? Title,
    string? Description,
    string? Type,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string? City,
    string? Format,
    string? Venue,
    string? OnlineLink,
    int? Capacity,
    string? Visibility)
{
    public bool IsOnline => string.Equals(Format, nameof(EventFormat.Online), StringComparison.Ordinal);
}

public class SaveEventValidator : AbstractValidator<SaveEventCommand>
{
    public const int MaxTitle = 200;
    public const int MaxDescription = 4000;
    public const int MaxCity = 100;
    public const int MaxVenue = 300;
    public const int MaxLink = 500;

    public SaveEventValidator()
    {
        RuleFor(x => x.Title).Cascade(CascadeMode.Stop)
            .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Give the event a title people will recognise.")
            .Must(t => t!.Trim().Length <= MaxTitle).WithMessage($"Use {MaxTitle} characters or fewer for the title.");
        RuleFor(x => x.Description)
            .Must(d => (d?.Trim().Length ?? 0) <= MaxDescription).WithMessage($"Use {MaxDescription} characters or fewer for the description.");
        RuleFor(x => x.Type)
            .Must(IsName<EventType>).WithMessage("Choose a type from the list.");
        RuleFor(x => x.EndsAt)
            .Must((command, ends) => ends > command.StartsAt).WithMessage("The end time must be after the start time.");
        RuleFor(x => x.City).Cascade(CascadeMode.Stop)
            .Must(c => !string.IsNullOrWhiteSpace(c)).WithMessage("Enter the city the event is in.")
            .Must(c => c!.Trim().Length <= MaxCity).WithMessage($"Use {MaxCity} characters or fewer for the city.");
        RuleFor(x => x.Format)
            .Must(IsName<EventFormat>).WithMessage("Choose In person or Online.");
        RuleFor(x => x.Visibility)
            .Must(IsName<EventVisibility>).WithMessage("Choose Public or Members only.");
        When(x => !x.IsOnline, () => RuleFor(x => x.Venue).Cascade(CascadeMode.Stop)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Enter a venue address, or choose Online.")
            .Must(v => v!.Trim().Length <= MaxVenue).WithMessage($"Use {MaxVenue} characters or fewer for the venue."));
        When(x => x.IsOnline, () => RuleFor(x => x.OnlineLink).Cascade(CascadeMode.Stop)
            .Must(l => !string.IsNullOrWhiteSpace(l)).WithMessage("Enter the joining link, or choose In person.")
            .Must(l => l!.Trim().Length <= MaxLink).WithMessage($"Use {MaxLink} characters or fewer for the link.")
            .Must(IsWebAddress).WithMessage("Enter a link that starts with https://"));
        RuleFor(x => x.Capacity)
            .Must(c => c is null or >= 1).WithMessage("Capacity must be at least 1, or leave it empty for no limit.");
    }

    // Names only: Enum.TryParse would also accept numbers such as "7".
    private static bool IsName<T>(string? value)
        where T : struct, Enum => value is not null && Enum.GetNames<T>().Contains(value, StringComparer.Ordinal);

    private static bool IsWebAddress(string? value) =>
        Uri.TryCreate(value?.Trim(), UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);
}

/// <summary>
/// Creates and edits events for event managers (L2-020). An edit raises the event's sequence (L2-024), tells every
/// member who RSVP'd that it changed in the app (AC4), and emails everyone who RSVP'd, guests too, the new details with
/// the updated .ics (L2-028). A System Admin acting without an event role is audited.
/// </summary>
public class SaveEventHandler(
    IApplicationDbContext db,
    EventPermissions permissions,
    INotificationPublisher notifications,
    IIcsCalendarWriter calendar,
    IEmailSender email,
    IAuditLog audit)
{
    public async Task<(Result Result, Guid? Id)> CreateAsync(SaveEventCommand command, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageEvents || await permissions.CallerProfileIdAsync(cancellationToken) is not { } creator)
        {
            return (Result.Forbidden(), null);
        }

        var details = Details.From(command);
        var created = new Event(
            details.Title, details.Description, details.Type, command.StartsAt, command.EndsAt, details.City,
            details.Format, details.Venue, details.OnlineLink, command.Capacity, details.Visibility, creator);
        db.Events.Add(created);
        if (permissions.IsAdminOverride)
        {
            audit.Record(creator, "event.created", "Event", created.Id.ToString(), null, Snapshot(created));
        }

        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), created.Id);
    }

    public async Task<Result> UpdateAsync(Guid id, SaveEventCommand command, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageEvents || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return Result.Forbidden();
        }

        var existing = await db.Events.Include(e => e.Rsvps).SingleOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (existing is null)
        {
            return Result.NotFound();
        }

        if (existing.IsCancelled)
        {
            return Result.Conflict("This event is cancelled, so it can’t be edited.");
        }

        var before = Snapshot(existing);
        var details = Details.From(command);
        existing.Update(
            details.Title, details.Description, details.Type, command.StartsAt, command.EndsAt, details.City,
            details.Format, details.Venue, details.OnlineLink, command.Capacity, details.Visibility);
        var link = $"/events/{existing.Id}";
        var subject = $"Changed: {existing.Title}";
        var attachments = new[] { EventEmails.Calendar(existing, calendar) };
        EmailContent Content(string path) => new(
            "This event has changed",
            [
                $"The hosts updated {existing.Title}. Here are the new details:",
                $"{EventEmails.When(existing)}\n{EventEmails.Where(existing)}",
                "The attached calendar file updates it in your calendar.",
            ],
            new EmailAction("See the event", path));
        await notifications.PublishAsync(
            existing.Rsvps.Select(r => r.ProfileId).OfType<Guid>().Where(p => p != actor).ToList(),
            NotificationKind.EventChanged,
            $"{existing.Title} changed. Check the new details.",
            link,
            email: new NotificationEmail(subject, Content(link), attachments, CorrelationId: existing.Id.ToString()),
            cancellationToken: cancellationToken);
        foreach (var guest in existing.Rsvps.Where(r => r.IsGuest).Select(r => r.GuestEmail!).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            await email.SendAsync(
                new EmailMessage(
                    guest, subject, Content($"/public/events/{existing.Id}"), nameof(NotificationKind.EventChanged), existing.Id.ToString(), attachments),
                cancellationToken);
        }

        if (permissions.IsAdminOverride)
        {
            audit.Record(actor, "event.updated", "Event", existing.Id.ToString(), before, Snapshot(existing));
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private static object Snapshot(Event e) => new
    {
        e.Title,
        Type = e.Type.ToString(),
        e.StartsAt,
        e.EndsAt,
        e.City,
        Format = e.Format.ToString(),
        e.Venue,
        e.OnlineLink,
        e.Capacity,
        Visibility = e.Visibility.ToString(),
    };

    /// <summary>The validated command, trimmed and parsed; the field the format does not use is dropped.</summary>
    private sealed record Details(
        string Title, string Description, EventType Type, string City, EventFormat Format, string? Venue, string? OnlineLink, EventVisibility Visibility)
    {
        public static Details From(SaveEventCommand c)
        {
            var format = Enum.Parse<EventFormat>(c.Format!);
            return new Details(
                c.Title!.Trim(),
                c.Description?.Trim() ?? string.Empty,
                Enum.Parse<EventType>(c.Type!),
                c.City!.Trim(),
                format,
                format == EventFormat.InPerson ? c.Venue!.Trim() : null,
                format == EventFormat.Online ? c.OnlineLink!.Trim() : null,
                Enum.Parse<EventVisibility>(c.Visibility!));
        }
    }
}
