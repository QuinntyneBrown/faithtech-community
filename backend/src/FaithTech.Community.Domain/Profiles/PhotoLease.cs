namespace FaithTech.Community.Domain.Profiles;

/// <summary>
/// Part of a <see cref="Profile"/> that serializes writes to its photos, so overlapping requests cannot
/// pass the 10-photo limit or leave two featured photos (L2-007). A write takes the lease in a save that
/// changes nothing else; <see cref="Version"/> is an optimistic concurrency token, so of two overlapping
/// writes that read the same version only one can take it. The holder then changes the photos and
/// releases the lease in one save. A lease left by a request that failed expires after
/// <see cref="LeaseLength"/>.
/// </summary>
public class PhotoLease
{
    public static readonly TimeSpan LeaseLength = TimeSpan.FromSeconds(30);

    public Guid Version { get; private set; } = Guid.NewGuid();

    public Guid? Holder { get; private set; }

    public DateTimeOffset? ExpiresAt { get; private set; }

    /// <summary>Takes the lease unless another write holds it; save to make it count.</summary>
    public bool TryTake(DateTimeOffset now)
    {
        if (Holder is not null && ExpiresAt > now)
        {
            return false;
        }

        Holder = Guid.NewGuid();
        ExpiresAt = now + LeaseLength;
        Version = Guid.NewGuid();
        return true;
    }

    public void Release()
    {
        Holder = null;
        ExpiresAt = null;
        Version = Guid.NewGuid();
    }
}
