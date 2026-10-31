using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Notifications;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

public record CancelEventCommand(string? Reason);

public class CancelEventValidator : AbstractValidator<CancelEventCommand>
{
    public const int MaxReason = 500;

    public CancelEventValidator()
    {
        RuleFor(x => x.Reason).Cascade(CascadeMode.Stop)
            .Must(r => !string.IsNullOrWhiteSpace(r)).WithMessage("Tell attendees why, so they aren’t left guessing.")
            .Must(r => r!.Trim().Length <= MaxReason).WithMessage($"Use {MaxReason} characters or fewer for the message.");
    }
}

/// <summary>
/// Cancels an event for event managers (L2-025): records the reason, who and when, raises the sequence, tells every
/// member who RSVP'd in-app and emails every member and guest who RSVP'd the reason with the cancelled .ics.
/// </summary>
public class CancelEventHandler(
    IApplicationDbContext db,
    EventPermissions permissions,
    INotificationPublisher notifications,
    IIcsCalendarWriter calendar,
    IEmailQueue emails,
    IAuditLog audit,
    ICurrentOrganisation organisation,
    TimeProvider time)
{
    public async Task<Result> HandleAsync(Guid id, CancelEventCommand command, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageEvents || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return Result.Forbidden();
        }

        var e = await db.Events.Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null)
        {
            return Result.NotFound();
        }

        if (e.IsCancelled)
        {
            return Result.Conflict("This event is already cancelled.");
        }

        var reason = command.Reason!.Trim();
        e.Cancel(reason, actor, time.GetUtcNow());
        var link = $"/events/{e.Id}";
        var members = e.Rsvps.Select(r => r.ProfileId).OfType<Guid>().ToList();
        foreach (var member in members.Where(m => m != actor))
        {
            notifications.Publish(member, NotificationKind.EventCancelled, $"{e.Title} was cancelled", link);
        }

        if (permissions.IsAdminOverride)
        {
            audit.Record(actor, "event.cancelled", "Event", e.Id.ToString(), null, new { Reason = reason });
        }

        // Everyone who RSVP'd hears why, the person who cancelled included, since their RSVP is cancelled too.
        var addresses = await db.Profiles.Where(p => members.Contains(p.Id))
            .Join(db.Users, p => p.UserId, u => (Guid?)u.Id, (p, u) => u.Email!).ToListAsync(cancellationToken);
        // A walk-in may have given no email.
        addresses.AddRange(e.Rsvps.Where(r => r.IsGuest && r.GuestEmail is not null).Select(r => r.GuestEmail!));
        var origin = organisation.Origin;
        foreach (var address in addresses.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            emails.Enqueue(new EmailMessage(
                address,
                $"Cancelled: {e.Title}",
                $"{e.Title} is cancelled. The hosts said:\n\n“{reason}”\n\n" +
                $"The attached calendar file removes it from your calendar. See the event: {origin}{link}",
                [new EmailAttachment(EventFileNames.Calendar(e.Title), "text/calendar", calendar.Write(e))]));
        }

        // The cancellation, the notifications and the emails commit together (L2-028, L2-047).
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
