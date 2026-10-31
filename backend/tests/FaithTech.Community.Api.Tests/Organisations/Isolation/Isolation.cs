using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations.Isolation;

/// <summary>
/// Arranges records in a second organisation through the API on its own host, then looks for them from FaithTech
/// (L2-130 AC2, AC3). Each record carries a marker no FaithTech record holds.
/// </summary>
public static class Isolation
{
    public static string Marker() => $"Northside-{Guid.NewGuid():N}"[..20];

    /// <summary>A client on the second organisation's host, signed in as a new member there holding <paramref name="roles"/>.</summary>
    public static async Task<HttpClient> NorthsideClientAsync(this CommunityApiFactory factory, params Role[] roles)
    {
        var northside = await factory.AddOrganisationAsync();
        var member = await factory.AddMemberAsync(northside, Marker(), roles);
        return factory.ClientOn(northside, member);
    }

    /// <summary>A FaithTech System Admin, who may read anything in FaithTech, so a miss is the organisation's doing.</summary>
    public static async Task<HttpClient> FaithTechAdminAsync(this CommunityApiFactory factory) =>
        factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);

    public static async Task<Guid> CreatedIdAsync(this HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("id").GetGuid();
    }

    public static async Task AssertNotFoundAsync(this HttpClient client, string path)
    {
        var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    public static async Task AssertListLacksAsync(this HttpClient client, string path, string marker)
    {
        var response = await client.GetAsync(path);
        Assert.True(response.IsSuccessStatusCode, $"{path}: {(int)response.StatusCode}");
        Assert.DoesNotContain(marker, await response.Content.ReadAsStringAsync());
    }

    public static Task<HttpResponseMessage> PostAsync(this HttpClient client, string path, object body) =>
        client.PostAsJsonAsync(path, body);
}
