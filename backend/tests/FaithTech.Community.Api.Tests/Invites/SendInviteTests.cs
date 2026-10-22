// Traces to: L2-010, L2-002
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Invites;

public class SendInviteTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Lead_sends_an_invite_email_with_a_single_use_link_that_expires_after_14_days()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/invites",
            new { Email = email, PreassignedRole = "ProductEngineer", Note = "Loved your demo at Builders Night!" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = (await response.Content.ReadFromJsonAsync<InviteDto>())!;
        Assert.Equal(("Pending", "ProductEngineer", "Grace Okonkwo"), (dto.Status, dto.PreassignedRole, dto.InvitedByName));
        var message = Assert.Single(factory.Emails.SentTo(email));
        Assert.Contains("Grace Okonkwo invited you to join FaithTech Community as a Product Engineer", message.Body);
        Assert.Contains("Loved your demo at Builders Night!", message.Body);
        Assert.Contains($"{CommunityApiFactory.WebAppOrigin}/accept-invite/", message.Body);
        var token = InviteClients.TokenFrom(message.Body);
        var invite = await factory.LoadInviteAsync(dto.Id);
        Assert.Equal(InviteClients.Hash(token), invite.TokenHash);
        Assert.DoesNotContain(token, invite.TokenHash);
        Assert.Equal(invite.CreatedAt.AddDays(14), invite.ExpiresAt);
        Assert.Equal(grace.ProfileId, invite.InvitedBy);
    }

    [Theory]
    [InlineData(Role.CityLead, "Staff")]
    [InlineData(Role.CityLead, "CityLead")]
    [InlineData(Role.CityLead, "SystemAdmin")]
    [InlineData(Role.EventLead, "Volunteer")]
    public async Task Only_roles_the_inviter_may_grant_can_be_preassigned(Role inviterRole, string role)
    {
        var lead = await factory.AddMemberAsync("Marcus Lee");

        var response = await factory.ClientFor(lead, inviterRole).PostAsJsonAsync("/api/invites",
            new { Email = "nate@example.org", PreassignedRole = role });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("You can’t give that role.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Theory]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Any_lead_or_system_admin_may_invite_without_a_role(Role role)
    {
        var lead = await factory.AddMemberAsync("Hannah Kim");

        var response = await factory.ClientFor(lead, role).PostAsJsonAsync("/api/invites", new { Email = $"{Guid.NewGuid():N}@example.org" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.ProductEngineer)]
    public async Task Anyone_without_a_lead_role_or_system_admin_gets_403(params Role[] roles)
    {
        var member = await factory.AddMemberAsync("Jonah Bell");

        var send = await factory.ClientFor(member, roles).PostAsJsonAsync("/api/invites", new { Email = "nate@example.org" });
        var list = await factory.ClientFor(member, roles).GetAsync("/api/invites");

        Assert.Equal(HttpStatusCode.Forbidden, send.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);
    }

    [Fact]
    public async Task An_unverified_lead_must_verify_before_inviting()
    {
        var lead = await factory.AddMemberAsync("Marcus Lee");
        await factory.SetEmailConfirmedAsync(lead, false);

        var response = await factory.ClientFor(lead, Role.EventLead).PostAsJsonAsync("/api/invites", new { Email = "nate@example.org" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("Verify your email before sending invites.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Theory]
    [InlineData("nate@", "Email", "Enter an email like name@example.org.")]
    [InlineData("", "Email", "Enter an email like name@example.org.")]
    public async Task Invalid_email_is_rejected(string email, string field, string message)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/invites", new { Email = email });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([message], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
    }

    [Fact]
    public async Task More_than_50_invites_in_24_hours_are_rate_limited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        for (var i = 0; i < 50; i++)
        {
            await factory.AddInviteAsync(grace, $"bulk{i}@example.org", age: TimeSpan.FromHours(23));
        }

        var client = factory.ClientFor(grace, Role.CityLead);
        var limited = await client.PostAsJsonAsync("/api/invites", new { Email = "one-more@example.org" });

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("You’ve sent 50 invites in the last 24 hours. Try again tomorrow.", (await limited.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Empty(factory.Emails.SentTo("one-more@example.org"));

        factory.Time.Advance(TimeSpan.FromHours(1) + TimeSpan.FromMinutes(1));
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/invites", new { Email = "one-more@example.org" })).StatusCode);
    }

    [Fact]
    public async Task Leads_see_invites_from_every_lead_with_their_status()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var (pending, _) = await factory.AddInviteAsync(grace, "nate@example.org", Role.ProductEngineer, TimeSpan.FromDays(1));
        var (expired, _) = await factory.AddInviteAsync(marcus, "felix@example.org", Role.Attendee, TimeSpan.FromDays(20));
        var (accepted, _) = await factory.AddInviteAsync(marcus, "ruth@example.org", Role.Volunteer, TimeSpan.FromDays(3));
        await factory.WithDbAsync(async db =>
        {
            (await db.Invites.SingleAsync(i => i.Id == accepted.Id)).MarkAccepted(Guid.NewGuid(), factory.Time.GetUtcNow());
            return await db.SaveChangesAsync();
        });

        var invites = (await factory.ClientFor(marcus, Role.EventLead).GetFromJsonAsync<InvitePage>("/api/invites?pageSize=100"))!.Items;

        var byId = invites.ToDictionary(i => i.Id);
        Assert.Equal("Pending", byId[pending.Id].Status);
        Assert.Equal("Grace Okonkwo", byId[pending.Id].InvitedByName);
        Assert.Equal("Expired", byId[expired.Id].Status);
        Assert.Equal("Accepted", byId[accepted.Id].Status);
        Assert.Equal(invites.OrderByDescending(i => i.CreatedAt).Select(i => i.Id), invites.Select(i => i.Id));
    }

    [Fact]
    public async Task Resending_an_expired_invite_sends_a_new_14_day_link()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        var (expired, oldToken) = await factory.AddInviteAsync(grace, email, Role.Attendee, TimeSpan.FromDays(15));

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/invites/{expired.Id}/resend", null);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = (await response.Content.ReadFromJsonAsync<InviteDto>())!;
        Assert.NotEqual(expired.Id, dto.Id);
        Assert.Equal(("Pending", "Attendee", email), (dto.Status, dto.PreassignedRole, dto.Email));
        var token = InviteClients.TokenFrom(Assert.Single(factory.Emails.SentTo(email)).Body);
        Assert.NotEqual(oldToken, token);
        var renewed = await factory.LoadInviteAsync(dto.Id);
        Assert.Equal(factory.Time.GetUtcNow().AddDays(14), renewed.ExpiresAt);
    }

    [Fact]
    public async Task Only_an_expired_invite_can_be_resent()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var (pending, _) = await factory.AddInviteAsync(grace, "nate@example.org");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/invites/{pending.Id}/resend", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Revoking_a_pending_invite_stops_its_link()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var (pending, _) = await factory.AddInviteAsync(grace, "nate@example.org");
        var client = factory.ClientFor(grace, Role.CityLead);

        var revoke = await client.PostAsync($"/api/invites/{pending.Id}/revoke", null);
        var again = await client.PostAsync($"/api/invites/{pending.Id}/revoke", null);

        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal(InviteStatus.Revoked, (await factory.LoadInviteAsync(pending.Id)).Status(factory.Time.GetUtcNow()));
    }

    private sealed record InvitePage(List<InviteDto> Items, string? Next, int TotalCount);

    private sealed record InviteDto(Guid Id, string Email, string? PreassignedRole, string Status, string InvitedByName, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);
}
