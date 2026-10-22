using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Invites;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Invites;

/// <summary>Lists, resends and revokes invites for leads and System Admins (L2-010 AC4, AC5).</summary>
public class ManageInvitesHandler(IApplicationDbContext db, InviteSender sender, TimeProvider time)
{
    public const int DefaultPageSize = 50;

    /// <summary>
    /// One page of every lead's invites, newest first (ties broken by id), at most
    /// <see cref="PageRequest.MaxPageSize"/> a page. <paramref name="after"/> is the previous page's
    /// <see cref="InvitePageDto.Next"/>: a keyset continuation, so invites sent meanwhile never shift
    /// later pages. Forbidden when the caller may not see invites; invalid for a malformed continuation.
    /// </summary>
    public async Task<(Result Result, InvitePageDto? Page)> ListAsync(
        string? after, int? pageSize, CancellationToken cancellationToken = default)
    {
        if (!sender.CanInvite)
        {
            return (Result.Forbidden(), null);
        }

        var cursor = InviteCursor.Parse(after);
        if (after is not null && cursor is null)
        {
            return (Result.Invalid("After", "That page link is out of date. Reload the list."), null);
        }

        var size = Math.Clamp(pageSize ?? DefaultPageSize, 1, PageRequest.MaxPageSize);
        var total = await db.Invites.CountAsync(cancellationToken);
        var invites = db.Invites.AsNoTracking();
        if (cursor is { } c)
        {
            invites = invites.Where(i => i.CreatedAt < c.CreatedAt || (i.CreatedAt == c.CreatedAt && i.Id.CompareTo(c.Id) < 0));
        }

        var now = time.GetUtcNow();
        var rows = await invites
            .OrderByDescending(i => i.CreatedAt)
            .ThenByDescending(i => i.Id)
            .Take(size + 1)
            .GroupJoin(db.Profiles.AsNoTracking(), i => i.InvitedBy, p => p.Id, (i, p) => new { Invite = i, Inviters = p })
            .SelectMany(x => x.Inviters.DefaultIfEmpty(), (x, p) => new { x.Invite, Name = p == null ? null : p.Name })
            .ToListAsync(cancellationToken);
        // The join keeps the order in SQL, but not in every provider: order the page again in memory.
        rows = [.. rows.OrderByDescending(r => r.Invite.CreatedAt).ThenByDescending(r => r.Invite.Id)];
        var page = rows.Take(size).ToList();
        var next = rows.Count > size ? new InviteCursor(page[^1].Invite.CreatedAt, page[^1].Invite.Id).ToString() : null;
        return (Result.Ok(), new InvitePageDto([.. page.Select(r => InviteDto.From(r.Invite, r.Name ?? "A former member", now))], next, total));
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
