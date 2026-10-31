using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Api.Middleware.Organisations;

/// <summary>
/// The organisation <see cref="OrganisationResolutionMiddleware"/> resolved from the host and stored on the request.
/// Reading it on a request the middleware did not resolve is a bug, so it throws rather than guessing.
/// </summary>
public class HttpCurrentOrganisation(IHttpContextAccessor accessor) : ICurrentOrganisation
{
    private Organisation Organisation =>
        accessor.HttpContext?.Items[OrganisationResolutionMiddleware.OrganisationItem] as Organisation
        ?? throw new InvalidOperationException("No organisation was resolved for this request.");

    public Guid Id => Organisation.Id;

    public string Slug => Organisation.Slug;

    public string Name => Organisation.Name;

    public string ShortName => Organisation.ShortName;

    public string Host => Organisation.Host;

    public OrganisationStatus Status => Organisation.Status;
}
