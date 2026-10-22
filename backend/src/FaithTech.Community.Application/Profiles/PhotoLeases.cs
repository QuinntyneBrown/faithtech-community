using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

/// <summary>Takes and releases a profile's <see cref="PhotoLease"/> around a photo write.</summary>
public class PhotoLeases(IApplicationDbContext db, TimeProvider time)
{
    public const string ChangedMeanwhile = "Your photos changed while this was saving. Reload and try again.";

    /// <summary>
    /// Takes the lease of a freshly loaded, otherwise unchanged profile and saves it. False when another
    /// photo write holds the lease, or took it after this profile was loaded; the photos read with the
    /// profile are then not safe to change.
    /// </summary>
    public async Task<bool> TakeAsync(Profile profile, CancellationToken cancellationToken)
    {
        if (!profile.PhotoLease.TryTake(time.GetUtcNow()))
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
    public async Task ReleaseAsync(Profile profile, CancellationToken cancellationToken)
    {
        profile.PhotoLease.Release();
        await db.SaveChangesAsync(cancellationToken);
    }
}
