using System.Net.Http.Json;
using System.Web;
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Invites;

/// <summary>A lead's connect link, read through the API, and the token taken out of it.</summary>
public static partial class ConnectClients
{
    public record LinkBody(string Url);

    public record LookupBody(Guid LeadProfileId, string LeadName, string? LeadPhotoUrl, string? LeadCity, string LeadRole);

    /// <summary>A City Lead's link as "My QR code" shows it; issues one on first use.</summary>
    public static async Task<string> ConnectTokenOfAsync(this CommunityApiFactory factory, ProfileClients.Member lead, Role role = Role.CityLead)
    {
        var link = await factory.ClientFor(lead, role).GetFromJsonAsync<LinkBody>("/api/connect/link");
        return TokenFrom(link!.Url);
    }

    /// <summary>Signs up through a connect link and returns the verification link from the email.</summary>
    public static async Task<(Guid UserId, string Token)> SignUpThroughAsync(
        this CommunityApiFactory factory, string connectToken, string email, string name = "Tomás Ortega")
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/connect/sign-up",
            new { token = connectToken, name, email, password = Identity.OidcFlow.Password });
        response.EnsureSuccessStatusCode();
        return VerificationLinkTo(factory, email);
    }

    public static (Guid UserId, string Token) VerificationLinkTo(this CommunityApiFactory factory, string email)
    {
        var body = factory.Emails.SentTo(email).Last().Body;
        var url = new Uri(body.Split('\n').Single(l => l.StartsWith(CommunityApiFactory.WebAppOrigin)));
        var query = HttpUtility.ParseQueryString(url.Query);
        return (Guid.Parse(query["userId"]!), query["token"]!);
    }

    public static async Task VerifyAsync(this CommunityApiFactory factory, (Guid UserId, string Token) link) =>
        (await factory.CreateClient().PostAsJsonAsync("/api/account/verify-email", new { link.UserId, link.Token })).EnsureSuccessStatusCode();

    public static string TokenFrom(string url) =>
        ConnectLink().Match(url) is { Success: true } match ? match.Groups[1].Value : throw new InvalidOperationException(url);

    [GeneratedRegex(@"/meet/([A-Za-z0-9_-]+)$")]
    private static partial Regex ConnectLink();
}
