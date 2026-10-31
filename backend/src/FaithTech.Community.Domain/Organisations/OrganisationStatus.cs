namespace FaithTech.Community.Domain.Organisations;

public enum OrganisationStatus
{
    /// <summary>Held only while provisioning writes the organisation's defaults in one unit of work.</summary>
    Provisioning,
    Active,
    Suspended,
}
