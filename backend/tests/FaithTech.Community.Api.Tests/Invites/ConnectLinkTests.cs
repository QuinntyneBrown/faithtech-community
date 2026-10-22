// Traces to: L2-080, L2-081, L2-082
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Invites.ConnectClients;

namespace FaithTech.Community.Api.Tests.Invites;

public class ConnectLinkTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_City_Lead_gets_one_reusable_link_whose_token_is_never_stored_in_plain_text()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.CityLead);

        var first = await client.GetFromJsonAsync<LinkBody>("/api/connect/link");
        var again = await client.GetFromJsonAsync<LinkBody>("/api/connect/link");

        Assert.StartsWith($"{CommunityApiFactory.WebAppOrigin}/meet/", first!.Url);
        Assert.Equal(first.Url, again!.Url);
        var token = TokenFrom(first.Url);
        Assert.Equal(43, token.Length);
        var stored = await factory.WithDbAsync(db => db.ConnectLinks.AsNoTracking().SingleAsync(l => l.OwnerId == grace.ProfileId));
        Assert.Equal(InviteClients.Hash(token), stored.TokenHash);
        Assert.DoesNotContain(token, stored.ProtectedToken);
    }

    [Fact]
    public async Task A_System_Admin_has_their_own_link()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");

        var response = await factory.ClientFor(priya, Role.SystemAdmin).GetAsync("/api/connect/link");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(Role.Staff)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.Volunteer)]
    public async Task Everyone_else_is_refused(Role? role)
    {
        var member = await factory.AddMemberAsync("Daniel Reyes");
        var client = role is { } r ? factory.ClientFor(member, r) : factory.ClientFor(member);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/connect/link")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync("/api/connect/link", null)).StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.ConnectLinks.AnyAsync(l => l.OwnerId == member.ProfileId)));
    }

    [Fact]
    public async Task Anyone_with_the_link_sees_who_they_are_connecting_with()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p =>
        {
            p.Update("Grace Okonkwo", "Toronto", null);
            p.AddPhoto(new ProfilePhoto($"profiles/{p.Id}/grace.jpg", "Grace at Builders Night", DateTime.UtcNow));
        });
        var token = await factory.ConnectTokenOfAsync(grace);

        var lookup = await LookUpAsync(factory.CreateClient(), token);

        Assert.Equal(new LookupBody(grace.ProfileId, "Grace Okonkwo", $"{FakePhotoStorage.BaseUrl}profiles/{grace.ProfileId}/grace.jpg", "Toronto", "City Lead"), lookup);
        var unknown = await factory.CreateClient().PostAsJsonAsync("/api/connect/lookup", new { token = "nope" });
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task Making_a_new_code_retires_the_old_link()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var old = await factory.ConnectTokenOfAsync(grace);

        var replaced = await factory.ClientFor(grace, Role.CityLead).PostAsync("/api/connect/link", null);

        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        var fresh = TokenFrom((await replaced.Content.ReadFromJsonAsync<LinkBody>())!.Url);
        Assert.NotEqual(old, fresh);
        Assert.Equal(fresh, await factory.ConnectTokenOfAsync(grace));
        var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.PostAsJsonAsync("/api/connect/lookup", new { token = old })).StatusCode);
        Assert.NotNull(await LookUpAsync(anonymous, fresh));
    }

    [Fact]
    public async Task A_link_stops_working_while_its_owner_is_suspended_or_no_longer_a_City_Lead()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var graceToken = await factory.ConnectTokenOfAsync(grace);
        var estherToken = await factory.ConnectTokenOfAsync(esther);
        await factory.WithDbAsync(async db =>
        {
            (await db.Profiles.SingleAsync(p => p.Id == grace.ProfileId)).Suspend("Spam", DateTime.UtcNow);
            (await db.Profiles.SingleAsync(p => p.Id == esther.ProfileId)).RemoveRole(Role.CityLead);
            return await db.SaveChangesAsync();
        });
        var anonymous = factory.CreateClient();

        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.PostAsJsonAsync("/api/connect/lookup", new { token = graceToken })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.PostAsJsonAsync("/api/connect/lookup", new { token = estherToken })).StatusCode);
    }

    private static async Task<LookupBody?> LookUpAsync(HttpClient client, string token)
    {
        var response = await client.PostAsJsonAsync("/api/connect/lookup", new { token });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<LookupBody>();
    }
}
