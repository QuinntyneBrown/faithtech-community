namespace FaithTech.Community.Domain.Admin;

/// <summary>
/// A single row that serializes System Admin removals, so the "always one System Admin" rule cannot be
/// raced (L2-009). A removal first takes the lease in a save of its own; <see cref="Version"/> is an
/// optimistic concurrency token, so of two overlapping removals only one can take it. The holder counts
/// the admins, makes its change and releases the lease in one save. A lease left by a request that
/// failed expires after <see cref="LeaseLength"/>.
/// </summary>
public class SystemAdminRoster
{
    public static readonly Guid SingletonId = new("5a3c1d2e-0000-4000-8000-000000000001");

    public static readonly TimeSpan LeaseLength = TimeSpan.FromSeconds(30);

    public SystemAdminRoster()
    {
        Id = SingletonId;
        Version = Guid.NewGuid();
    }

    public Guid Id { get; private set; }

    public Guid Version { get; private set; }

    public Guid? LeaseHolder { get; private set; }

    public DateTimeOffset? LeaseExpiresAt { get; private set; }

    /// <summary>Takes the lease unless another removal holds it; save to make it count.</summary>
    public bool TryTake(Guid holder, DateTimeOffset now)
    {
        if (LeaseHolder is not null && LeaseExpiresAt > now)
        {
            return false;
        }

        LeaseHolder = holder;
        LeaseExpiresAt = now + LeaseLength;
        Version = Guid.NewGuid();
        return true;
    }

    public void Release()
    {
        LeaseHolder = null;
        LeaseExpiresAt = null;
        Version = Guid.NewGuid();
    }
}
