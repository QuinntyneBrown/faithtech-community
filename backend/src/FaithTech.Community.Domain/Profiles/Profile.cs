namespace FaithTech.Community.Domain.Profiles;

public class Profile
{
    private readonly List<ProfileRole> _roles = [];
    private readonly List<object> _domainEvents = [];

    private Profile() { }

    public Profile(string name)
    {
        Id = Guid.NewGuid();
        Name = name;
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public IReadOnlyCollection<ProfileRole> Roles => _roles;

    public bool IsSuspended { get; private set; }

    public IReadOnlyList<object> DomainEvents => _domainEvents;

    public void Suspend() => IsSuspended = true;

    public bool HasRole(Role role) => _roles.Any(r => r.Role == role);

    public void AddRole(Role role, Guid grantedBy, DateTime nowUtc)
    {
        if (HasRole(role))
        {
            throw new InvalidOperationException($"The profile already holds the {role} role.");
        }

        _roles.Add(new ProfileRole(Id, role, grantedBy, nowUtc));
    }

    public void RemoveRole(Role role)
    {
        var held = _roles.FirstOrDefault(r => r.Role == role)
            ?? throw new InvalidOperationException($"The profile does not hold the {role} role.");

        _roles.Remove(held);
        if (role == Role.CityLead)
        {
            _domainEvents.Add(new CityLeadRoleRemoved(Id));
        }
    }

    public void ClearDomainEvents() => _domainEvents.Clear();
}
