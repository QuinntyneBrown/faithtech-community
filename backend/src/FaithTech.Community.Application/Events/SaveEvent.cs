using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Organisations;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>
/// The event form's fields, for both create and edit (L2-020). Type is one of the organisation's event type keys
/// (L2-145 AC2); format and visibility are enum names;
/// the venue is kept only for in-person events and the link only for online ones. The chapter is optional: none means
/// organisation-wide (L2-141 AC2).
/// </summary>
public record SaveEventCommand(
    string? Title,
    string? Description,
    string? Type,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    Guid? ChapterId,
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
    public const int MaxVenue = 300;
    public const int MaxLink = 500;
    public const string ChooseType = "Choose a type from the list.";

    public SaveEventValidator()
    {
        RuleFor(x => x.Title).Cascade(CascadeMode.Stop)
            .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage("Give the event a title people will recognise.")
            .Must(t => t!.Trim().Length <= MaxTitle).WithMessage($"Use {MaxTitle} characters or fewer for the title.");
        RuleFor(x => x.Description)
            .Must(d => (d?.Trim().Length ?? 0) <= MaxDescription).WithMessage($"Use {MaxDescription} characters or fewer for the description.");
        RuleFor(x => x.Type)
            .Must(t => !string.IsNullOrWhiteSpace(t)).WithMessage(ChooseType);
        RuleFor(x => x.EndsAt)
            .Must((command, ends) => ends > command.StartsAt).WithMessage("The end time must be after the start time.");
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
/// Creates and edits events for event managers (L2-020). An edit raises the event's sequence (L2-024) and tells
/// every member who RSVP'd that it changed (AC4). A System Admin acting without an event role is audited.
/// </summary>
public class SaveEventHandler(
    IApplicationDbContext db,
    EventPermissions permissions,
    INotificationPublisher notifications,
    IAuditLog audit,
    ICurrentOrganisation organisation)
{
    public async Task<(Result Result, Guid? Id)> CreateAsync(SaveEventCommand command, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageEvents || await permissions.CallerProfileIdAsync(cancellationToken) is not { } creator)
        {
            return (Result.Forbidden(), null);
        }

        var chapterId = organisation.ChapterLabelSingular is null ? null : command.ChapterId;
        if (await ChapterRefusalAsync(chapterId, null, cancellationToken) is { } refused)
        {
            return (refused, null);
        }

        // A new event takes an active type (L2-145 AC2).
        if (await TypeAsync(command.Type, null, cancellationToken) is not { } type)
        {
            return (Result.Invalid(nameof(SaveEventCommand.Type), SaveEventValidator.ChooseType), null);
        }

        var details = Details.From(command);
        var created = new Event(
            details.Title, details.Description, type, command.StartsAt, command.EndsAt, chapterId,
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

        // While chapters are off the form has no picker, so the event keeps its chapter (L2-140 AC6).
        var chapterId = organisation.ChapterLabelSingular is null ? existing.ChapterId : command.ChapterId;
        if (await ChapterRefusalAsync(chapterId, existing.ChapterId, cancellationToken) is { } refused)
        {
            return refused;
        }

        // An edit may keep the event's archived type, but not choose another archived one (L2-145 AC2, AC4).
        if (await TypeAsync(command.Type, existing.TypeId, cancellationToken) is not { } type)
        {
            return Result.Invalid(nameof(SaveEventCommand.Type), SaveEventValidator.ChooseType);
        }

        var before = Snapshot(existing);
        var details = Details.From(command);
        existing.Update(
            details.Title, details.Description, type, command.StartsAt, command.EndsAt, chapterId,
            details.Format, details.Venue, details.OnlineLink, command.Capacity, details.Visibility);
        foreach (var member in existing.Rsvps.Select(r => r.ProfileId).OfType<Guid>().Where(p => p != actor))
        {
            notifications.Publish(member, NotificationKind.EventChanged, $"{existing.Title} changed. Check the new details.", $"/events/{existing.Id}");
        }

        if (permissions.IsAdminOverride)
        {
            audit.Record(actor, "event.updated", "Event", existing.Id.ToString(), before, Snapshot(existing));
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    /// <summary>The organisation's type with this key: an active one, or the event's current type.</summary>
    private Task<EventType?> TypeAsync(string? key, Guid? current, CancellationToken cancellationToken) =>
        db.EventTypes.FirstOrDefaultAsync(t => t.Key == key && (t.ArchivedAtUtc == null || t.Id == current), cancellationToken);

    /// <summary>A chapter other than the event's own must be an active one of this organisation (L2-141 AC2).</summary>
    private async Task<Result?> ChapterRefusalAsync(Guid? chapterId, Guid? current, CancellationToken cancellationToken) =>
        chapterId is { } picked && picked != current
            && !await db.Chapters.AnyAsync(c => c.Id == picked && c.ArchivedAtUtc == null, cancellationToken)
            ? Result.Invalid(nameof(SaveEventCommand.ChapterId), Chapters.ChooseFromList(organisation))
            : null;

    private static object Snapshot(Event e) => new
    {
        e.Title,
        Type = e.Type?.Key,
        e.StartsAt,
        e.EndsAt,
        e.ChapterId,
        Format = e.Format.ToString(),
        e.Venue,
        e.OnlineLink,
        e.Capacity,
        Visibility = e.Visibility.ToString(),
    };

    /// <summary>The validated command, trimmed and parsed; the field the format does not use is dropped.</summary>
    private sealed record Details(
        string Title, string Description, EventFormat Format, string? Venue, string? OnlineLink, EventVisibility Visibility)
    {
        public static Details From(SaveEventCommand c)
        {
            var format = Enum.Parse<EventFormat>(c.Format!);
            return new Details(
                c.Title!.Trim(),
                c.Description?.Trim() ?? string.Empty,
                format,
                format == EventFormat.InPerson ? c.Venue!.Trim() : null,
                format == EventFormat.Online ? c.OnlineLink!.Trim() : null,
                Enum.Parse<EventVisibility>(c.Visibility!));
        }
    }
}
