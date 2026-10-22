using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>The versions of the archived partner and of the partner it was merged into, as the page loaded them.</summary>
public record RestorePartnerCommand(int? Version, int? MergedIntoVersion);

public class RestorePartnerValidator : AbstractValidator<RestorePartnerCommand>
{
    public RestorePartnerValidator()
    {
        RuleFor(x => x.Version).NotNull().GreaterThanOrEqualTo(0).WithMessage("Reload the partner and try again.");
        RuleFor(x => x.MergedIntoVersion).NotNull().GreaterThanOrEqualTo(0).WithMessage("Reload the partner and try again.");
    }
}

/// <summary>
/// A System Admin makes a merged partner active again (L2-115 AC4 to AC6, ADR 0028): every entry and
/// stage change first written on it moves back, wherever it now lives, and both partners get a
/// Restored entry. The kept record keeps the values and joined notes the merge gave it.
/// </summary>
public class RestorePartnerHandler(IApplicationDbContext db, PartnerAccess access, PartnerViews views, TimeProvider time)
{
    public async Task<(Result Result, PartnerDto? Partner)> RestoreAsync(Guid id, RestorePartnerCommand command, CancellationToken cancellationToken = default)
    {
        if (!access.CanRestore)
        {
            return (Result.Forbidden(), null);
        }

        var partner = await db.Partners.SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (partner is null)
        {
            return (Result.NotFound(), null);
        }

        if (!partner.IsArchived)
        {
            return (Result.Conflict($"{partner.Name} is not archived."), null);
        }

        var kept = await db.Partners.SingleAsync(p => p.Id == partner.MergedIntoId, cancellationToken);
        if (kept.IsArchived)
        {
            return (Result.Conflict($"Restore {kept.Name} first."), null);
        }

        if (partner.Version != command.Version || kept.Version != command.MergedIntoVersion)
        {
            return (Stale(), null);
        }

        var before = new { partner.ArchivedAtUtc, partner.MergedIntoId, partner.MergedById, partner.MergedAtUtc, KeptVersion = kept.Version };
        var activities = await db.PartnerActivities.Where(a => a.MergedFromPartnerId == id).ToListAsync(cancellationToken);
        var changes = await db.PartnerStageChanges.Where(c => c.MergedFromPartnerId == id).ToListAsync(cancellationToken);
        foreach (var activity in activities)
        {
            activity.MoveBack();
        }

        foreach (var change in changes)
        {
            change.MoveBack();
        }

        partner.Restore();
        kept.TouchForRestore();
        var actor = await access.CallerProfileIdAsync(cancellationToken);
        var nowUtc = time.GetUtcNow().UtcDateTime;
        db.PartnerActivities.Add(PartnerActivity.Restored(partner, kept, actor, nowUtc, isRestoredRecord: true));
        db.PartnerActivities.Add(PartnerActivity.Restored(kept, partner, actor, nowUtc, isRestoredRecord: false));
        access.Audit(actor, partner, "partner.restored", before, new
        {
            partner.ArchivedAtUtc,
            partner.MergedIntoId,
            MovedActivities = activities.Count,
            MovedStageChanges = changes.Count,
        });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return (Stale(), null);
        }

        return (Result.Ok(), await views.ToDtoAsync(partner, cancellationToken));
    }

    private static Result Stale() =>
        Result.Conflict("Someone changed these partners since the page loaded. Nothing was changed; reload and try again.");
}
