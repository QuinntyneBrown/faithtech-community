// Traces to: L2-082, L2-084
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Invites;

public class ConnectMemberTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private sealed record ConnectBody(string Outcome, string LeadName);

    [Fact]
    public async Task A_signed_in_member_is_connected_at_once_and_a_repeat_changes_nothing()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var jonah = await factory.AddMemberAsync("Jonah Bell", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));
        var token = await factory.ConnectTokenOfAsync(grace);
        var client = factory.ClientFor(jonah);

        var first = await client.PostAsJsonAsync("/api/connect", new { token });
        var again = await client.PostAsJsonAsync("/api/connect", new { token });

        Assert.Equal(new ConnectBody("Connected", "Grace Okonkwo"), await first.Content.ReadFromJsonAsync<ConnectBody>());
        Assert.Equal(new ConnectBody("Connected", "Grace Okonkwo"), await again.Content.ReadFromJsonAsync<ConnectBody>());
        var contact = Assert.Single(await factory.WithDbAsync(db => db.Contacts.AsNoTracking().Where(c => c.OwnerId == grace.ProfileId).ToListAsync()));
        Assert.Equal(("Jonah Bell", await factory.EmailOfAsync(jonah), jonah.ProfileId), (contact.Name, contact.Email, contact.LinkedProfileId));
        var notice = Assert.Single(await factory.WithDbAsync(db => db.Notifications.AsNoTracking().Where(n => n.RecipientId == grace.ProfileId).ToListAsync()));
        Assert.Equal("Jonah Bell connected with you", notice.Title);
        var roles = (await factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == jonah.ProfileId))).Roles;
        Assert.Equal([Role.Volunteer], roles.Select(r => r.Role));
    }

    [Fact]
    public async Task A_member_whose_email_is_not_verified_is_connected_once_it_is()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var leah = await factory.AddMemberAsync("Leah Thompson");
        await factory.SetEmailConfirmedAsync(leah, false);
        var token = await factory.ConnectTokenOfAsync(grace);

        var response = await factory.ClientFor(leah).PostAsJsonAsync("/api/connect", new { token });

        Assert.Equal("Pending", (await response.Content.ReadFromJsonAsync<ConnectBody>())!.Outcome);
        Assert.False(await factory.WithDbAsync(db => db.Contacts.AnyAsync(c => c.OwnerId == grace.ProfileId)));

        await factory.VerifyAsync(await VerificationTokenAsync(leah));

        var contact = Assert.Single(await factory.WithDbAsync(db => db.Contacts.AsNoTracking().Where(c => c.OwnerId == grace.ProfileId).ToListAsync()));
        Assert.Equal(leah.ProfileId, contact.LinkedProfileId);
        Assert.False(await factory.WithDbAsync(db => db.PendingConnections.AnyAsync(p => p.ProfileId == leah.ProfileId)));
    }

    [Fact]
    public async Task A_lead_opening_their_own_code_creates_nothing()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var token = await factory.ConnectTokenOfAsync(grace);

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/connect", new { token });

        Assert.Equal("OwnCode", (await response.Content.ReadFromJsonAsync<ConnectBody>())!.Outcome);
        Assert.False(await factory.WithDbAsync(db => db.Contacts.AnyAsync(c => c.OwnerId == grace.ProfileId)));
    }

    [Fact]
    public async Task An_unknown_link_is_not_found_and_connecting_needs_a_sign_in()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var token = await factory.ConnectTokenOfAsync(grace);

        Assert.Equal(HttpStatusCode.NotFound, (await factory.ClientFor(jonah).PostAsJsonAsync("/api/connect", new { token = "nope" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync("/api/connect", new { token })).StatusCode);
    }

    // Members added straight to the database have no security stamp, so the token is issued here.
    private async Task<(Guid UserId, string Token)> VerificationTokenAsync(ProfileClients.Member member)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<CommunityUser>>();
        var user = (await users.FindByIdAsync(member.UserId.ToString()))!;
        await users.UpdateSecurityStampAsync(user);
        return (user.Id, await users.GenerateEmailConfirmationTokenAsync(user));
    }
}
