using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations.Platform;

/// <summary>POST /api/platform/organisations/{slug}/suspend and <c>org suspend</c>: why the organisation is suspended.</summary>
public record SuspendOrganisationCommand(string? Reason);

/// <summary>
/// Suspends and lifts an organisation for an operator (L2-150). Suspending sets the status with the reason, so from the
/// next request its hosts answer the neutral suspended page (L2-131 AC3), and revokes its members' sessions issued on
/// those hosts, leaving their sessions in other organisations (AC1, AC2). Lifting makes it Active again; members sign in
/// again (AC3). Each action goes to the platform audit log.
/// </summary>
public class SuspendOrganisationHandler(IApplicationDbContext db, ITokenRevocation revocation, IPlatformAuditLog audit, TimeProvider time)
{
    public const int MaxReasonLength = 500;

    public async Task<Result> SuspendAsync(string slug, SuspendOrganisationCommand command, CancellationToken cancellationToken = default)
    {
        var reason = command.Reason?.Trim();
        if (string.IsNullOrEmpty(reason))
        {
            return Result.Invalid(nameof(SuspendOrganisationCommand.Reason), "Enter a reason.");
        }

        if (reason.Length > MaxReasonLength)
        {
            return Result.Invalid(nameof(SuspendOrganisationCommand.Reason), $"Use {MaxReasonLength} characters or fewer.");
        }

        if (await FindAsync(slug, cancellationToken) is not { } organisation)
        {
            return Result.NotFound();
        }

        if (organisation.Status != OrganisationStatus.Active)
        {
            return Result.Conflict($"{organisation.Slug} is {organisation.Status.ToString().ToLowerInvariant()}.");
        }

        organisation.Suspend(reason, time.GetUtcNow().UtcDateTime);
        audit.Record("organisation.suspended", organisation.Slug, organisation.Slug, new { Reason = reason });
        await db.SaveChangesAsync(cancellationToken);

        var members = await db.Profiles.IgnoreQueryFilters()
            .Where(p => p.OrganisationId == organisation.Id && p.UserId != null)
            .Select(p => p.UserId!.Value)
            .ToListAsync(cancellationToken);
        foreach (var userId in members)
        {
            await revocation.RevokeAsync(userId, organisation.Id, cancellationToken);
        }

        return Result.Ok();
    }

    public async Task<Result> LiftAsync(string slug, CancellationToken cancellationToken = default)
    {
        if (await FindAsync(slug, cancellationToken) is not { } organisation)
        {
            return Result.NotFound();
        }

        if (organisation.Status != OrganisationStatus.Suspended)
        {
            return Result.Conflict($"{organisation.Slug} is not suspended.");
        }

        organisation.Lift();
        audit.Record("organisation.lifted", organisation.Slug, organisation.Slug, null);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private Task<Organisation?> FindAsync(string slug, CancellationToken cancellationToken)
    {
        var key = slug.Trim().ToLowerInvariant();
        return db.Organisations.SingleOrDefaultAsync(o => o.Slug == key, cancellationToken);
    }
}
