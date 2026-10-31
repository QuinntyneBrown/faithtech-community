namespace FaithTech.Community.Domain.Organisations;

/// <summary>
/// A record that belongs to exactly one organisation (ADR 0032, L2-130). The context stamps the id when the record is
/// added and filters every query on it, so it has no public setter.
/// </summary>
public interface IOrganisationScoped
{
    Guid OrganisationId { get; }
}
