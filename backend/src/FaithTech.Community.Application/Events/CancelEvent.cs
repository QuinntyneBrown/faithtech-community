using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
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
    IEmailSender email,
    IAuditLog audit,
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
        await notifications.PublishAsync(
            members.Where(m => m != actor).ToList(), NotificationKind.EventCancelled, $"{e.Title} was cancelled", link,
            cancellationToken: cancellationToken);

        if (permissions.IsAdminOverride)
        {
            audit.Record(actor, "event.cancelled", "Event", e.Id.ToString(), null, new { Reason = reason });
        }

        // Everyone who RSVP'd hears why, the person who cancelled included, since their RSVP is cancelled too.
        var addresses = await db.Users.Where(u => members.Contains(u.ProfileId)).Select(u => u.Email!).ToListAsync(cancellationToken);
        addresses.AddRange(e.Rsvps.Where(r => r.IsGuest).Select(r => r.GuestEmail!));
        var content = new EmailContent(
            "This event has been cancelled",
            [
                $"{e.Title} ({EventEmails.When(e)}) is cancelled. The hosts said: “{reason}”",
                "The attached calendar file removes it from your calendar.",
            ],
            new EmailAction("See the event", link));
        foreach (var address in addresses.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            await email.SendAsync(
                new EmailMessage(
                    address, $"Cancelled: {e.Title}", content, nameof(NotificationKind.EventCancelled), e.Id.ToString(),
                    [EventEmails.Calendar(e, calendar)]),
                cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
