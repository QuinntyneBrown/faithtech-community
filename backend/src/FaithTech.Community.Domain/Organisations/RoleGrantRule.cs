namespace FaithTech.Community.Domain.Organisations;

/// <summary>Holders of the grantor role may add and remove the grantable role on any profile (ADR 0033).</summary>
public class RoleGrantRule
{
    private RoleGrantRule() { }

    internal RoleGrantRule(Guid grantorRoleId, Guid grantableRoleId)
    {
        GrantorRoleId = grantorRoleId;
        GrantableRoleId = grantableRoleId;
    }

    public Guid GrantorRoleId { get; private set; }

    public Guid GrantableRoleId { get; private set; }
}
