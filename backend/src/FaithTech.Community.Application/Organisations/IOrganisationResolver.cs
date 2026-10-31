using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Organisations;

/// <summary>Finds an organisation by its community host or its slug: one indexed query per call, no cache (L2-150 AC1).</summary>
public interface IOrganisationResolver
{
    /// <summary>The organisation whose community host is <paramref name="host"/>, compared case-insensitively, or null.</summary>
    Task<Organisation?> ResolveByHostAsync(string host, CancellationToken cancellationToken = default);

    Task<Organisation?> ResolveBySlugAsync(string slug, CancellationToken cancellationToken = default);
}
