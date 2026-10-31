namespace FaithTech.Community.Domain.Organisations;

/// <summary>
/// One row per organisation that serialises the changes which could leave it without an administrator, so the "always
/// one administrator" rule cannot be raced (L2-139 AC2). A guarded change first takes the lease in a save of its own;
/// <see cref="Version"/> is an optimistic concurrency token, so of two overlapping changes only one can take it. The
/// holder counts the administrators, makes its change and releases the lease in one save. A lease left by a request
/// that failed expires after <see cref="LeaseLength"/>.
/// </summary>
public class OrganisationAdminRoster : IOrganisationScoped
{
    public static readonly TimeSpan LeaseLength = TimeSpan.FromSeconds(30);

    public OrganisationAdminRoster()
    {
        Id = Guid.NewGuid();
        Version = Guid.NewGuid();
    }

    public Guid Id { get; private set; }

    public Guid OrganisationId { get; private set; }

    public Guid Version { get; private set; }

    public Guid? LeaseHolder { get; private set; }

    public DateTimeOffset? LeaseExpiresAt { get; private set; }

    /// <summary>Takes the lease unless another change holds it; save to make it count.</summary>
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
