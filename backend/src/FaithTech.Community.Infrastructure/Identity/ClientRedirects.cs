using FaithTech.Community.Application.Organisations.Platform;
using FaithTech.Community.Infrastructure.Persistence;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Infrastructure.Identity;

public class ClientRedirects(IOpenIddictApplicationManager applications) : IClientRedirects
{
    public async Task AllowOriginAsync(string origin, CancellationToken cancellationToken = default)
    {
        var client = await applications.FindByClientIdAsync(CommunitySeeder.WebClientId, cancellationToken)
            ?? throw new InvalidOperationException("The web client is not seeded. Run seed first.");
        var descriptor = new OpenIddictApplicationDescriptor();
        await applications.PopulateAsync(descriptor, client, cancellationToken);
        var redirect = new Uri($"{origin.TrimEnd('/')}/auth/callback");
        var postLogout = new Uri($"{origin.TrimEnd('/')}/");
        if (descriptor.RedirectUris.Contains(redirect) && descriptor.PostLogoutRedirectUris.Contains(postLogout))
        {
            return;
        }

        descriptor.RedirectUris.Add(redirect);
        descriptor.PostLogoutRedirectUris.Add(postLogout);
        await applications.UpdateAsync(client, descriptor, cancellationToken);
    }
}
