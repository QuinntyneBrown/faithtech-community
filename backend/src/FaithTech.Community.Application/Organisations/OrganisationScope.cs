using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// The ambient organisation of one service scope: a request (set by the resolution middleware from the host), a
/// worker's unit of work (set per row from the row's OrganisationId) or a Cli command. Reading it before it is set
/// throws, so nothing ever runs against no organisation or a guessed one.
/// </summary>
public class OrganisationScope : ICurrentOrganisation
{
    private Guid? _id;
    private Organisation? _organisation;

    public bool IsSet => _id is not null;

    public Guid Id => _id ?? throw new InvalidOperationException("No organisation is in scope.");

    public string Slug => Loaded.Slug;

    public string Name => Loaded.Name;

    public string ShortName => Loaded.ShortName;

    public string Host => Loaded.Host;

    public OrganisationStatus Status => Loaded.Status;

    private Organisation Loaded => _organisation
        ?? throw new InvalidOperationException(_id is null ? "No organisation is in scope." : "The organisation in scope was set by id only.");

    /// <summary>Makes <paramref name="organisation"/> current for the rest of this scope.</summary>
    public void Set(Organisation organisation)
    {
        _id = organisation.Id;
        _organisation = organisation;
    }

    /// <summary>Makes the organisation with this id current, for work that holds only a row's OrganisationId.</summary>
    public void RunAs(Guid organisationId)
    {
        _id = organisationId;
        _organisation = null;
    }
}
