namespace FaithTech.Community.Domain.Profiles;

public class Profile
{
    private Profile() { }

    public Profile(string name)
    {
        Id = Guid.NewGuid();
        Name = name;
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public List<Role> Roles { get; private set; } = [];

    public bool IsSuspended { get; private set; }
}
