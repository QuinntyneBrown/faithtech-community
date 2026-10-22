using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Announcements;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Announcements;

/// <summary>Everyone, holders of any of <see cref="Roles"/>, or the members on the RSVP list of event <see cref="EventId"/>.</summary>
public record AudienceRequest(string? Kind, string[]? Roles = null, Guid? EventId = null);

public record SendAnnouncementCommand(string? Subject, string? Body, AudienceRequest? Audience, bool AlsoEmail = true);

/// <summary><see cref="EmailCount"/> is how many recipients also get it by email: none without Also send by email.</summary>
public record AnnouncementSentDto(Guid Id, int RecipientCount, int EmailCount);

public class AudienceRequestValidator : AbstractValidator<AudienceRequest>
{
    public const string ChooseEvent = "Choose an event.";

    public AudienceRequestValidator(IApplicationDbContext db)
    {
        RuleFor(x => x.Kind).Cascade(CascadeMode.Stop)
            .Must(kind => Enum.TryParse<AudienceKind>(kind, out var parsed) && Enum.IsDefined(parsed) && !int.TryParse(kind, out _))
            .WithMessage("Choose who to send it to.");
        RuleFor(x => x.EventId).Cascade(CascadeMode.Stop)
            .NotNull().WithMessage(ChooseEvent)
            .MustAsync((id, cancellationToken) => db.Events.AnyAsync(e => e.Id == id, cancellationToken)).WithMessage(ChooseEvent)
            .When(x => x.Kind == nameof(AudienceKind.EventRsvps));
        RuleFor(x => x.Roles).Cascade(CascadeMode.Stop)
            .Must(roles => roles is { Length: > 0 }).WithMessage("Choose at least one role.")
            .Must(roles => roles!.All(r => Enum.TryParse<Role>(r, out var role) && Enum.IsDefined(role) && !int.TryParse(r, out _)))
            .WithMessage("Choose roles from the list.")
            .When(x => x.Kind == nameof(AudienceKind.Roles));
    }
}

public class SendAnnouncementValidator : AbstractValidator<SendAnnouncementCommand>
{
    public const int MaxSubject = 150;
    public const int MaxBody = 5000;

    public SendAnnouncementValidator(IApplicationDbContext db)
    {
        RuleFor(x => x.Subject).Cascade(CascadeMode.Stop)
            .Must(s => !string.IsNullOrWhiteSpace(s)).WithMessage("Add a subject so people know what it’s about.")
            .Must(s => s!.Trim().Length <= MaxSubject).WithMessage($"Use {MaxSubject} characters or fewer for the subject.");
        RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
            .Must(b => !string.IsNullOrWhiteSpace(b)).WithMessage("Write a message of at least one sentence.")
            .Must(b => b!.Trim().Length <= MaxBody).WithMessage($"Use {MaxBody} characters or fewer for the message.");
        RuleFor(x => x.Audience).Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Choose who to send it to.")
            .SetValidator(new AudienceRequestValidator(db)!);
    }
}

/// <summary>Who may send, and who an audience reaches: every member who is not suspended (ADR 0010).</summary>
public class AnnouncementAudiences(IApplicationDbContext db, ICurrentUser current)
{
    public bool CanSend => current.HasRole(Role.CommunicationsLead) || current.HasRole(Role.SystemAdmin);

    public static AnnouncementAudience ToAudience(AudienceRequest request) => Enum.Parse<AudienceKind>(request.Kind!) switch
    {
        AudienceKind.Roles => AnnouncementAudience.ForRoles([.. request.Roles!.Select(Enum.Parse<Role>)]),
        AudienceKind.EventRsvps => AnnouncementAudience.ForEventRsvps(request.EventId!.Value),
        _ => AnnouncementAudience.Everyone(),
    };

    public IQueryable<Guid> RecipientIds(AnnouncementAudience audience)
    {
        var members = db.Profiles.Where(p => !p.IsSuspended);
        if (audience.Kind == AudienceKind.Roles)
        {
            var roles = audience.Roles.ToList();
            members = members.Where(p => p.Roles.Any(r => roles.Contains(r.Role)));
        }
        else if (audience.Kind == AudienceKind.EventRsvps)
        {
            // Members on the RSVP list; guests have no account, so no in-app notification to receive.
            var going = db.Events.Where(e => e.Id == audience.EventId).SelectMany(e => e.Rsvps).Select(r => r.ProfileId);
            members = members.Where(p => going.Contains(p.Id));
        }

        return members.Select(p => p.Id);
    }

    public static Result Invalid(FluentValidation.Results.ValidationResult validation) =>
        new(ResultStatus.Invalid, validation.ToDictionary().AsReadOnly());
}

public class CountAnnouncementRecipientsHandler(AnnouncementAudiences audiences, IValidator<AudienceRequest> validator)
{
    public async Task<(Result Result, int Count)> HandleAsync(AudienceRequest request, CancellationToken cancellationToken = default)
    {
        if (!audiences.CanSend)
        {
            return (Result.Forbidden(), 0);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return (AnnouncementAudiences.Invalid(validation), 0);
        }

        return (Result.Ok(), await audiences.RecipientIds(AnnouncementAudiences.ToAudience(request)).CountAsync(cancellationToken));
    }
}

/// <summary>Stores the announcement and notifies each recipient in the app and, unless they opted out, by email (L2-029).</summary>
public class SendAnnouncementHandler(
    IApplicationDbContext db,
    AnnouncementAudiences audiences,
    ProfileAccess access,
    IValidator<SendAnnouncementCommand> validator,
    INotificationPublisher notifications,
    IUnsubscribeTokens unsubscribe,
    TimeProvider time)
{
    public async Task<(Result Result, AnnouncementSentDto? Sent)> HandleAsync(SendAnnouncementCommand command, CancellationToken cancellationToken = default)
    {
        // Permission first, so nobody else learns anything from validation (L2-029 AC3).
        if (!audiences.CanSend)
        {
            return (Result.Forbidden(), null);
        }

        var validation = await validator.ValidateAsync(command, cancellationToken);
        if (!validation.IsValid)
        {
            return (AnnouncementAudiences.Invalid(validation), null);
        }

        var sender = await access.CallerProfileIdAsync(cancellationToken) ?? Guid.Empty;
        var senderName = await db.Profiles.Where(p => p.Id == sender).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken) ?? "FaithTech";
        var audience = AnnouncementAudiences.ToAudience(command.Audience!);
        var subject = command.Subject!.Trim();
        var body = command.Body!.Trim();
        var announcement = new Announcement(subject, body, audience, sender, time.GetUtcNow(), command.AlsoEmail);
        var recipients = await audiences.RecipientIds(audience).ToListAsync(cancellationToken);
        announcement.AddRecipients(recipients);
        db.Announcements.Add(announcement);

        // The mock's email (notifications/email/announcement): the subject, the message's paragraphs, a link to read it
        // in the app and, per recipient, the unsubscribe link (L2-030 AC3).
        var paragraphs = body.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var email = command.AlsoEmail
            ? new NotificationEmail(
                subject,
                new EmailContent(subject, [$"From {senderName}:", .. paragraphs], new EmailAction("Read in FaithTech", "/announcements")),
                UnsubscribePath: id => $"/unsubscribe?token={Uri.EscapeDataString(unsubscribe.Issue(id))}")
            : null;
        await notifications.PublishAsync(
            recipients, NotificationKind.Announcement, $"{senderName} sent “{subject}”", "/announcements", senderName, email, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        var emailCount = command.AlsoEmail
            ? await db.Profiles.CountAsync(p => recipients.Contains(p.Id) && !p.AnnouncementEmailsOptedOut, cancellationToken)
            : 0;
        return (Result.Ok(), new AnnouncementSentDto(announcement.Id, recipients.Count, emailCount));
    }
}
