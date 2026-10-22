using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

/// <summary>Takes and releases the <see cref="PhotoLease"/> of a profile or a contact around a photo write.</summary>
public class PhotoLeases(IApplicationDbContext db, TimeProvider time)
{
    public const string ChangedMeanwhile = "Your photos changed while this was saving. Reload and try again.";

    /// <summary>
    /// Takes the lease of a freshly loaded, otherwise unchanged profile and saves it. False when another
    /// photo write holds the lease, or took it after this profile was loaded; the photos read with the
    /// profile are then not safe to change.
    /// </summary>
    public Task<bool> TakeAsync(Profile profile, CancellationToken cancellationToken) =>
        TakeAsync(profile.PhotoLease, cancellationToken);

    /// <summary>Takes a lease read with its otherwise unchanged owner (a profile or a contact) and saves it.</summary>
    public async Task<bool> TakeAsync(PhotoLease lease, CancellationToken cancellationToken)
    {
        if (!lease.TryTake(time.GetUtcNow()))
        {
            return false;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }

    /// <summary>Releases the lease after a refusal that changes nothing else.</summary>
    public Task ReleaseAsync(Profile profile, CancellationToken cancellationToken) =>
        ReleaseAsync(profile.PhotoLease, cancellationToken);

    public async Task ReleaseAsync(PhotoLease lease, CancellationToken cancellationToken)
    {
        lease.Release();
        await db.SaveChangesAsync(cancellationToken);
    }
}
