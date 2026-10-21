using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Invites;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Invites;

/// <summary>Lists, resends and revokes invites for leads and System Admins (L2-010 AC4, AC5).</summary>
public class ManageInvitesHandler(IApplicationDbContext db, InviteSender sender, TimeProvider time)
{
    /// <summary>Every lead's invites, newest first; null when the caller may not see them.</summary>
    public async Task<IReadOnlyList<InviteDto>?> ListAsync(CancellationToken cancellationToken = default)
    {
        if (!sender.CanInvite)
        {
            return null;
        }

        var now = time.GetUtcNow();
        var rows = await db.Invites.AsNoTracking()
            .OrderByDescending(i => i.CreatedAt)
            .GroupJoin(db.Profiles.AsNoTracking(), i => i.InvitedBy, p => p.Id, (i, p) => new { Invite = i, Inviters = p })
            .SelectMany(x => x.Inviters.DefaultIfEmpty(), (x, p) => new { x.Invite, Name = p == null ? null : p.Name })
            .ToListAsync(cancellationToken);
        return [.. rows.Select(r => InviteDto.From(r.Invite, r.Name ?? "A former member", now))];
    }

    public async Task<(Result Result, InviteDto? Invite)> ResendAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!sender.CanInvite)
        {
            return (Result.Forbidden(), null);
        }

        var invite = await db.Invites.AsNoTracking().SingleOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (invite is null)
        {
            return (Result.NotFound(), null);
        }

        if (invite.Status(time.GetUtcNow()) != InviteStatus.Expired)
        {
            return (Result.Conflict("Only an expired invite can be resent."), null);
        }

        return await sender.CreateAsync(invite.Email, invite.PreassignedRole, invite.Note, cancellationToken);
    }

    public async Task<Result> RevokeAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!sender.CanInvite)
        {
            return Result.Forbidden();
        }

        var invite = await db.Invites.SingleOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (invite is null)
        {
            return Result.NotFound();
        }

        var now = time.GetUtcNow();
        if (invite.Status(now) != InviteStatus.Pending)
        {
            return Result.Conflict("Only a pending invite can be withdrawn.");
        }

        invite.Revoke(now);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
