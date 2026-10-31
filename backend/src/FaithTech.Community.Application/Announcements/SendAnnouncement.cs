using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Announcements;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Announcements;

/// <summary>Who an announcement goes to: <c>Everyone</c>, <c>Roles</c> (one or more) or one event's <c>EventRsvps</c>.</summary>
public record AudienceRequest(string? Kind, IReadOnlyList<string>? Roles = null, Guid? EventId = null);

/// <summary>A new announcement (L2-029). "Also send by email" is on unless turned off.</summary>
public record SendAnnouncementCommand(string? Subject, string? Body, AudienceRequest? Audience, bool AlsoEmail = true);

public record AnnouncementSent(Guid Id, int RecipientCount, int EmailCount);

public static class AnnouncementRules
{
    public const int MaxSubject = 200;
    public const int MaxBody = 5000;
    public const string SubjectMessage = "Add a subject so people know what it’s about.";
    public const string BodyMessage = "Write a message of at least one sentence.";
    public const string RolesMessage = "Choose at least one role.";
    public const string EventMessage = "Choose an event.";

    public static bool IsRole(string? value) => Enum.TryParse<Role>(value, ignoreCase: false, out _) && !int.TryParse(value, out _);
}

public class AudienceRequestValidator : AbstractValidator<AudienceRequest>
{
    public AudienceRequestValidator()
    {
        RuleFor(x => x.Kind)
            .Must(k => Enum.TryParse<AudienceKind>(k, out _) && !int.TryParse(k, out _))
            .WithMessage("Choose who to send it to.");
        When(x => x.Kind == nameof(AudienceKind.Roles), () =>
        {
            RuleFor(x => x.Roles).Cascade(CascadeMode.Stop)
                .Must(r => r is { Count: > 0 }).WithMessage(AnnouncementRules.RolesMessage)
                .Must(r => r!.All(AnnouncementRules.IsRole)).WithMessage(AnnouncementRules.RolesMessage);
        });
        When(x => x.Kind == nameof(AudienceKind.EventRsvps), () =>
            RuleFor(x => x.EventId).NotNull().WithMessage(AnnouncementRules.EventMessage));
    }
}

public class SendAnnouncementValidator : AbstractValidator<SendAnnouncementCommand>
{
    public SendAnnouncementValidator()
    {
        RuleFor(x => x.Subject).Cascade(CascadeMode.Stop)
            .Must(s => !string.IsNullOrWhiteSpace(s)).WithMessage(AnnouncementRules.SubjectMessage)
            .Must(s => s!.Trim().Length <= AnnouncementRules.MaxSubject)
            .WithMessage($"Use {AnnouncementRules.MaxSubject} characters or fewer for the subject.");
        RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
            .Must(b => !string.IsNullOrWhiteSpace(b)).WithMessage(AnnouncementRules.BodyMessage)
            .Must(b => b!.Trim().Length <= AnnouncementRules.MaxBody)
            .WithMessage($"Use {AnnouncementRules.MaxBody} characters or fewer for the message.");
        RuleFor(x => x.Audience).NotNull().WithMessage("Choose who to send it to.").SetValidator(new AudienceRequestValidator()!);
    }
}

/// <summary>Communications Leads and System Admins send announcements; everyone else gets 403 (L2-029 AC3).</summary>
public class AnnouncementAccess(ICurrentUser current)
{
    public bool CanSend => current.HasRole(Role.CommunicationsLead) || current.HasRole(Role.SystemAdmin);
}

/// <summary>
/// Resolves an audience to the members who receive it: members with an account who are not suspended (ADR 0016).
/// Guests who RSVP'd have no account, so an RSVP audience counts members only.
/// </summary>
public class AudienceResolver(IApplicationDbContext db)
{
    public IQueryable<Guid> RecipientIds(AnnouncementAudience audience)
    {
        var members = from user in db.Users
                      join profile in db.Profiles on user.ProfileId equals profile.Id
                      where !profile.IsSuspended
                      select profile;
        var roles = audience.Roles.ToList();
        return audience.Kind switch
        {
            AudienceKind.Everyone => members.Select(p => p.Id),
            AudienceKind.Roles => members.Where(p => p.Roles.Any(r => roles.Contains(r.Role))).Select(p => p.Id),
            AudienceKind.EventRsvps => members
                .Where(p => db.Events.Where(e => e.Id == audience.EventId).SelectMany(e => e.Rsvps).Any(r => r.ProfileId == p.Id))
                .Select(p => p.Id),
            _ => throw new ArgumentOutOfRangeException(nameof(audience)),
        };
    }

    /// <summary>The domain audience for a validated request, or null when its event does not exist.</summary>
    public async Task<AnnouncementAudience?> FromRequestAsync(AudienceRequest request, CancellationToken cancellationToken = default)
    {
        var kind = Enum.Parse<AudienceKind>(request.Kind!);
        return kind switch
        {
            AudienceKind.Everyone => AnnouncementAudience.Everyone(),
            AudienceKind.Roles => AnnouncementAudience.ForRoles([.. request.Roles!.Select(Enum.Parse<Role>).Distinct()]),
            _ => await db.Events.AnyAsync(e => e.Id == request.EventId, cancellationToken)
                ? AnnouncementAudience.ForEventRsvps(request.EventId!.Value)
                : null,
        };
    }
}

/// <summary>
/// Previews the recipient count and sends announcements (L2-029). Each recipient gets an in-app notification and,
/// with "Also send by email" on and unless they opted out, an email, all saved with the announcement in one save.
/// </summary>
public class SendAnnouncementHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    AnnouncementAccess access,
    AudienceResolver audiences,
    INotificationPublisher publisher,
    IUnsubscribeTokens unsubscribe,
    ICurrentOrganisation organisation,
    TimeProvider time)
{
    public const string LinkPath = "/announcements";

    public async Task<(Result Result, int Count)> CountAsync(AudienceRequest request, CancellationToken cancellationToken = default)
    {
        if (!access.CanSend)
        {
            return (Result.Forbidden(), 0);
        }

        var audience = await audiences.FromRequestAsync(request, cancellationToken);
        return audience is null
            ? (Result.Invalid("EventId", AnnouncementRules.EventMessage), 0)
            : (Result.Ok(), await audiences.RecipientIds(audience).CountAsync(cancellationToken));
    }

    public async Task<(Result Result, AnnouncementSent? Sent)> SendAsync(SendAnnouncementCommand command, CancellationToken cancellationToken = default)
    {
        if (!access.CanSend || current.UserId is not { } userId)
        {
            return (Result.Forbidden(), null);
        }

        var audience = await audiences.FromRequestAsync(command.Audience!, cancellationToken);
        if (audience is null)
        {
            return (Result.Invalid("Audience.EventId", AnnouncementRules.EventMessage), null);
        }

        var sender = await db.Users.Where(u => u.Id == userId).Select(u => u.ProfileId).SingleAsync(cancellationToken);
        var subject = command.Subject!.Trim();
        var body = command.Body!.Trim();
        var recipients = await audiences.RecipientIds(audience).ToListAsync(cancellationToken);

        var announcement = new Announcement(subject, body, audience, sender, time.GetUtcNow(), command.AlsoEmail);
        announcement.AddRecipients(recipients);
        db.Announcements.Add(announcement);
        var emails = await publisher.PublishAsync(
            recipients,
            NotificationKind.Announcement,
            subject,
            LinkPath,
            sender,
            command.AlsoEmail ? recipient => new NotificationEmail(subject, EmailBody(body, recipient)) : null,
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), new AnnouncementSent(announcement.Id, recipients.Count, emails));
    }

    /// <summary>The message with each recipient's own unsubscribe link (L2-030 AC3).</summary>
    private string EmailBody(string body, Guid recipient) =>
        $"{body}\n\nUnsubscribe from announcement emails (no sign-in needed): "
        + $"{organisation.Origin}/unsubscribe?token={Uri.EscapeDataString(unsubscribe.Issue(recipient))}";
}
