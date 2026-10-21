namespace FaithTech.Community.Domain.Profiles;

public class ProfileRole
{
    private ProfileRole() { }

    internal ProfileRole(Guid profileId, Role role, Guid grantedBy, DateTime grantedAtUtc)
    {
        ProfileId = profileId;
        Role = role;
        GrantedBy = grantedBy;
        GrantedAtUtc = grantedAtUtc;
    }

    public Guid ProfileId { get; private set; }

    public Role Role { get; private set; }

    public DateTime GrantedAtUtc { get; private set; }

    public Guid GrantedBy { get; private set; }
}
