using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>A call, email, meeting or note a lead logs on a partner's timeline (L2-085).</summary>
public record LogPartnerActivityCommand(
    string? Kind,
    string? Summary,
    DateOnly? OccurredOn,
    TimeOnly? OccurredAt = null,
    string? NextStep = null,
    DateOnly? NextStepDue = null);

public class LogPartnerActivityValidator : AbstractValidator<LogPartnerActivityCommand>
{
    public const int MaxSummary = 2000;
    public const int MaxNextStep = 200;

    public LogPartnerActivityValidator(TimeProvider time)
    {
        RuleFor(x => x.Kind)
            .Must(k => PartnerTimelineViews.TryParseLogged(k, out _)).WithMessage("Choose call, email, meeting or note.");
        RuleFor(x => x.Summary).Cascade(CascadeMode.Stop)
            .Must(s => !string.IsNullOrWhiteSpace(s)).WithMessage("Say what happened.")
            .Must(s => s!.Trim().Length <= MaxSummary).WithMessage("Use 2,000 characters or fewer for what happened.");
        // The server cannot know the lead's time zone, so "today" is the UTC date plus one day;
        // the dialog enforces the lead's own local today.
        RuleFor(x => x.OccurredOn).Cascade(CascadeMode.Stop)
            .NotNull().WithMessage("Enter the date it happened.")
            .Must(d => d <= DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime).AddDays(1)).WithMessage("Choose today or an earlier date.");
        RuleFor(x => x.NextStep)
            .Must(n => (n?.Trim().Length ?? 0) <= MaxNextStep).WithMessage("Use 200 characters or fewer for the next step.");
        RuleFor(x => x.NextStepDue)
            .Null().When(x => string.IsNullOrWhiteSpace(x.NextStep)).WithMessage("Add the next step, or clear its due date.");
    }
}

/// <summary>Logs an activity with who logged it and when (L2-085 AC2, L2-087).</summary>
public class LogPartnerActivityHandler(IApplicationDbContext db, PartnerAccess access, PartnerTimelineViews views, TimeProvider time)
{
    public async Task<(Result Result, PartnerActivityDto? Activity)> LogAsync(
        Guid partnerId, LogPartnerActivityCommand command, CancellationToken cancellationToken = default)
    {
        if (!access.CanWrite)
        {
            return (Result.Forbidden(), null);
        }

        var partner = await db.Partners.SingleOrDefaultAsync(p => p.Id == partnerId, cancellationToken);
        if (partner is null)
        {
            return (Result.NotFound(), null);
        }

        PartnerTimelineViews.TryParseLogged(command.Kind, out var kind);
        var actor = await access.CallerProfileIdAsync(cancellationToken);
        var nextStep = PartnerRules.Blank(command.NextStep);
        var activity = PartnerActivity.Log(
            partner.Id,
            kind,
            command.Summary!.Trim(),
            command.OccurredOn!.Value,
            command.OccurredAt,
            nextStep,
            nextStep is null ? null : command.NextStepDue,
            actor,
            time.GetUtcNow().UtcDateTime);
        db.PartnerActivities.Add(activity);
        // A System Admin without a lead role logs by admin right, so it is audited (L2-087 AC5).
        access.AuditAdminWrite(actor, partner, "partner.activity.logged", null, new
        {
            ActivityId = activity.Id,
            Kind = activity.Kind.ToString(),
            activity.OccurredOn,
            activity.Summary,
        });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), (await views.ToDtosAsync(partner, [activity], cancellationToken))[0]);
    }
}
