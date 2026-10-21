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

/// <summary>Everyone, holders of any of <see cref="Roles"/>, or one event's RSVP list (refused until events store RSVPs).</summary>
public record AudienceRequest(string? Kind, string[]? Roles = null, Guid? EventId = null);

public record SendAnnouncementCommand(string? Subject, string? Body, AudienceRequest? Audience, bool AlsoEmail = true);

public record AnnouncementSentDto(Guid Id, int RecipientCount);

public class AudienceRequestValidator : AbstractValidator<AudienceRequest>
{
    public AudienceRequestValidator()
    {
        RuleFor(x => x.Kind).Cascade(CascadeMode.Stop)
            .Must(kind => Enum.TryParse<AudienceKind>(kind, out var parsed) && Enum.IsDefined(parsed) && !int.TryParse(kind, out _))
            .WithMessage("Choose who to send it to.")
            .NotEqual(nameof(AudienceKind.EventRsvps)).WithMessage("Event audiences arrive with events.");
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

    public SendAnnouncementValidator()
    {
        RuleFor(x => x.Subject).Cascade(CascadeMode.Stop)
            .Must(s => !string.IsNullOrWhiteSpace(s)).WithMessage("Add a subject so people know what it’s about.")
            .Must(s => s!.Trim().Length <= MaxSubject).WithMessage($"Use {MaxSubject} characters or fewer for the subject.");
        RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
            .Must(b => !string.IsNullOrWhiteSpace(b)).WithMessage("Write a message of at least one sentence.")
            .Must(b => b!.Trim().Length <= MaxBody).WithMessage($"Use {MaxBody} characters or fewer for the message.");
        RuleFor(x => x.Audience).Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Choose who to send it to.")
            .SetValidator(new AudienceRequestValidator()!);
    }
}

/// <summary>Who may send, and who an audience reaches: every member who is not suspended (ADR 0010).</summary>
public class AnnouncementAudiences(IApplicationDbContext db, ICurrentUser current)
{
    public bool CanSend => current.HasRole(Role.CommunicationsLead) || current.HasRole(Role.SystemAdmin);

    public static AnnouncementAudience ToAudience(AudienceRequest request) =>
        Enum.Parse<AudienceKind>(request.Kind!) == AudienceKind.Roles
            ? AnnouncementAudience.ForRoles([.. request.Roles!.Select(Enum.Parse<Role>)])
            : AnnouncementAudience.Everyone();

    public IQueryable<Guid> RecipientIds(AnnouncementAudience audience)
    {
        var members = db.Profiles.Where(p => !p.IsSuspended);
        if (audience.Kind == AudienceKind.Roles)
        {
            var roles = audience.Roles.ToList();
            members = members.Where(p => p.Roles.Any(r => roles.Contains(r.Role)));
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
    IOptions<WebAppOptions> webApp,
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
        await db.SaveChangesAsync(cancellationToken);

        var origin = webApp.Value.Origin;
        var email = command.AlsoEmail
            ? new NotificationEmail(subject, $"{senderName} sent an announcement to FaithTech Community.\n\n{body}\n\nRead it in the app: {origin}/announcements")
            : null;
        await notifications.PublishAsync(
            recipients, NotificationKind.Announcement, $"{senderName} sent “{subject}”", "/announcements", senderName, email, cancellationToken);
        return (Result.Ok(), new AnnouncementSentDto(announcement.Id, recipients.Count));
    }
}
