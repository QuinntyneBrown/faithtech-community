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
}
