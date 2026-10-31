using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Admin;

public record SuspendUserCommand(string? Reason);

public class SuspendUserValidator : AbstractValidator<SuspendUserCommand>
{
    public const int MaxReason = 500;

    public SuspendUserValidator()
    {
        RuleFor(x => x.Reason).Cascade(CascadeMode.Stop)
            .Must(reason => !string.IsNullOrWhiteSpace(reason)).WithMessage("Give a reason so other admins understand.")
            .Must(reason => reason!.Trim().Length <= MaxReason).WithMessage($"Use {MaxReason} characters or fewer for the reason.");
    }
}

/// <summary>Suspends and reinstates accounts (L2-039); System Admin only, audited (L2-041).</summary>
public class SuspensionHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    ProfileAccess access,
    ITokenRevocation revocation,
    IAuditLog audit,
    TimeProvider time,
    ICurrentOrganisation organisation,
    LastAdministratorGuard lastAdministrator)
{
    public async Task<Result> SuspendAsync(Guid profileId, SuspendUserCommand command, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.AdministerOrganisation))
        {
            return Result.Forbidden();
        }

        var actor = await access.CallerProfileIdAsync(cancellationToken) ?? Guid.Empty;
        if (actor == profileId)
        {
            return Result.Conflict("You can’t suspend your own account.");
        }

        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return Result.NotFound();
        }

        if (profile.IsSuspended)
        {
            return Result.Conflict("This account is already suspended.");
        }

        // A suspended administrator no longer counts, so the organisation must keep another (L2-139 AC1, AC2).
        var guarded = await db.Profiles.Where(p => p.Id == profileId).AnyAsync(ProfileHolding.Capability(Capability.AdministerOrganisation), cancellationToken);
        if (guarded)
        {
            if (!await lastAdministrator.TakeLeaseAsync(cancellationToken))
            {
                return Result.Conflict(LastAdministratorGuard.ConcurrentChangeMessage);
            }

            if (await lastAdministrator.WouldLeaveNoneAsync(excludingProfile: profileId, cancellationToken: cancellationToken))
            {
                lastAdministrator.Release();
                await db.SaveChangesAsync(cancellationToken);
                return Result.Conflict(LastAdministratorGuard.LastAdministratorMessage);
            }

            lastAdministrator.Release();
        }

        var reason = command.Reason!.Trim();
        profile.Suspend(reason, time.GetUtcNow().UtcDateTime);
        audit.Record(actor, "user.suspended", "Profile", profileId.ToString(), new { IsSuspended = false }, new { IsSuspended = true, Reason = reason });
        await db.SaveChangesAsync(cancellationToken);

        // Signed out of this organisation: its sessions stop working at once, the account's others carry on (L2-132 AC5).
        if (profile.UserId is { } userId)
        {
            await revocation.RevokeAsync(userId, organisation.Id, cancellationToken);
        }

        return Result.Ok();
    }

    public async Task<Result> ReinstateAsync(Guid profileId, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.AdministerOrganisation))
        {
            return Result.Forbidden();
        }

        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return Result.NotFound();
        }

        if (!profile.IsSuspended)
        {
            return Result.Conflict("This account isn’t suspended.");
        }

        var actor = await access.CallerProfileIdAsync(cancellationToken) ?? Guid.Empty;
        var before = new { IsSuspended = true, Reason = profile.SuspendedReason };
        profile.Reinstate();
        audit.Record(actor, "user.reinstated", "Profile", profileId.ToString(), before, new { IsSuspended = false });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
