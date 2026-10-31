using FaithTech.Community.Application.Identity;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Infrastructure.Identity;

public class TokenRevocation(IOpenIddictAuthorizationManager authorizations, IOpenIddictTokenManager tokens) : ITokenRevocation
{
    public async Task RevokeAllAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var subject = userId.ToString();

        await foreach (var authorization in authorizations.FindBySubjectAsync(subject, cancellationToken))
        {
            await authorizations.TryRevokeAsync(authorization, cancellationToken);
        }

        await foreach (var token in tokens.FindBySubjectAsync(subject, cancellationToken))
        {
            await tokens.TryRevokeAsync(token, cancellationToken);
        }
    }

    public async Task RevokeAsync(Guid userId, Guid organisationId, CancellationToken cancellationToken = default)
    {
        await foreach (var authorization in authorizations.FindBySubjectAsync(userId.ToString(), cancellationToken))
        {
            var properties = await authorizations.GetPropertiesAsync(authorization, cancellationToken);
            if (properties.TryGetValue(TokenRevocationProperties.OrganisationId, out var stamp)
                && stamp.ValueKind == System.Text.Json.JsonValueKind.String
                && stamp.GetGuid() != organisationId)
            {
                continue;
            }

            await authorizations.TryRevokeAsync(authorization, cancellationToken);
            if (await authorizations.GetIdAsync(authorization, cancellationToken) is { } id)
            {
                await foreach (var token in tokens.FindByAuthorizationIdAsync(id, cancellationToken))
                {
                    await tokens.TryRevokeAsync(token, cancellationToken);
                }
            }
        }
    }
}
