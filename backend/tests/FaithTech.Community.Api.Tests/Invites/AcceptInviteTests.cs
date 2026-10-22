// Traces to: L2-011, L2-041
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Invites;

public class AcceptInviteTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Anyone_with_the_link_sees_who_invited_them_and_with_which_role()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p => p.Update("Grace Okonkwo", "Toronto", null));
        var (_, token) = await factory.AddInviteAsync(grace, "ruth.alvarez@example.org", Role.Volunteer);

        var lookup = await LookUpAsync(factory.CreateClient(), token);

        Assert.Equal(new Lookup("Pending", "ruth.alvarez@example.org", "Grace Okonkwo", "Toronto", "Volunteer", false), lookup);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().PostAsJsonAsync("/api/invites/lookup", new { token = "nope" })).StatusCode);
    }

    [Fact]
    public async Task Stale_links_report_their_status()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var (_, expired) = await factory.AddInviteAsync(grace, "felix@example.org", age: TimeSpan.FromDays(15));
        var (revoked, revokedToken) = await factory.AddInviteAsync(grace, "nate@example.org");
        await factory.WithDbAsync(async db =>
        {
            (await db.Invites.SingleAsync(i => i.Id == revoked.Id)).Revoke(factory.Time.GetUtcNow());
            return await db.SaveChangesAsync();
        });
        var anonymous = factory.CreateClient();

        Assert.Equal("Expired", (await LookUpAsync(anonymous, expired))!.Status);
        Assert.Equal("Revoked", (await LookUpAsync(anonymous, revokedToken))!.Status);
        var accept = await anonymous.PostAsJsonAsync("/api/invites/accept", new { Token = expired, Name = "Felix Wu", Password = OidcFlow.Password });
        Assert.Equal(HttpStatusCode.Conflict, accept.StatusCode);
        Assert.Equal("This invite has expired.", (await accept.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        var withdrawn = await anonymous.PostAsJsonAsync("/api/invites/accept", new { Token = revokedToken, Name = "Nate", Password = OidcFlow.Password });
        Assert.Equal("This invite was withdrawn.", (await withdrawn.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task Signing_up_with_the_invited_email_verifies_it_grants_the_role_and_tells_the_inviter()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        var (invite, token) = await factory.AddInviteAsync(grace, email, Role.Volunteer);

        var response = await factory.CreateClient().PostAsJsonAsync("/api/invites/accept",
            new { Token = token, Name = " Ruth Alvarez ", Password = OidcFlow.Password });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var (user, profile) = await factory.WithDbAsync(async db =>
        {
            var u = await db.Users.AsNoTracking().SingleAsync(x => x.Email == email);
            return (u, await db.Profiles.AsNoTracking().SingleAsync(p => p.Id == u.ProfileId));
        });
        Assert.True(user.EmailConfirmed);
        Assert.Equal("Ruth Alvarez", profile.Name);
        Assert.Equal([Role.Volunteer], profile.Roles.Select(r => r.Role));
        var accepted = await factory.LoadInviteAsync(invite.Id);
        Assert.Equal(InviteStatus.Accepted, accepted.Status(factory.Time.GetUtcNow()));
        Assert.Equal(profile.Id, accepted.AcceptedBy);
        var notification = await factory.WithDbAsync(db => db.Notifications.SingleAsync(n => n.RecipientId == grace.ProfileId));
        Assert.Equal(NotificationKind.InviteAccepted, notification.Kind);
        Assert.Equal("Ruth Alvarez accepted your invite", notification.Title);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == profile.Id.ToString()));
        Assert.Equal(("role.granted", grace.ProfileId), (entry.Action, entry.ActorId));

        var signIn = await new OidcFlow(factory).SignInAsync(email);
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        Assert.True((await signIn.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("emailVerified").GetBoolean());
    }

    // Traces to: L2-100 AC1 (docs/detailed-designs/reports/reports-dashboard): a new account from an invite records
    // the join time.
    [Fact]
    public async Task Signing_up_from_an_invite_records_the_join_time()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        var (_, token) = await factory.AddInviteAsync(grace, email, Role.Volunteer);

        await factory.CreateClient().PostAsJsonAsync("/api/invites/accept", new { Token = token, Name = "Ruth Alvarez", Password = OidcFlow.Password });

        var joined = await factory.WithDbAsync(async db =>
        {
            var user = await db.Users.AsNoTracking().SingleAsync(u => u.Email == email);
            return (await db.Profiles.AsNoTracking().SingleAsync(p => p.Id == user.ProfileId)).JoinedAtUtc;
        });
        Assert.Equal(factory.Time.GetUtcNow().UtcDateTime, joined);
    }

    [Fact]
    public async Task An_invite_works_only_once()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var (_, token) = await factory.AddInviteAsync(grace, $"{Guid.NewGuid():N}@example.org");
        var anonymous = factory.CreateClient();
        await anonymous.PostAsJsonAsync("/api/invites/accept", new { Token = token, Name = "Ruth", Password = OidcFlow.Password });

        var again = await anonymous.PostAsJsonAsync("/api/invites/accept", new { Token = token, Name = "Someone", Password = OidcFlow.Password });

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("This invite has already been used.", (await again.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal("Accepted", (await LookUpAsync(anonymous, token))!.Status);
    }

    [Fact]
    public async Task An_existing_account_signed_in_with_the_invited_email_gets_the_role()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var jonah = await factory.AddMemberAsync("Jonah Bell", p => p.AddRole(Role.Attendee, Guid.Empty, DateTime.UtcNow));
        var email = await EmailOfAsync(jonah);
        var (invite, token) = await factory.AddInviteAsync(grace, email.ToUpperInvariant(), Role.Volunteer);
        Assert.True((await LookUpAsync(factory.CreateClient(), token))!.HasAccount);

        var response = await factory.ClientFor(jonah).PostAsJsonAsync("/api/invites/accept", new { Token = token });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var profile = await factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == jonah.ProfileId));
        Assert.Equal([Role.Volunteer, Role.Attendee], profile.Roles.Select(r => r.Role).Order());
        Assert.Equal(jonah.ProfileId, (await factory.LoadInviteAsync(invite.Id)).AcceptedBy);
        Assert.True(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == grace.ProfileId && n.Kind == NotificationKind.InviteAccepted)));
    }

    [Fact]
    public async Task A_signed_in_account_with_another_email_cannot_take_the_invite()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var (invite, token) = await factory.AddInviteAsync(grace, "ruth.alvarez@example.org", Role.Volunteer);

        var response = await factory.ClientFor(jonah).PostAsJsonAsync("/api/invites/accept", new { Token = token });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("This invite is for another email.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal(InviteStatus.Pending, (await factory.LoadInviteAsync(invite.Id)).Status(factory.Time.GetUtcNow()));
    }

    [Fact]
    public async Task Signing_up_with_an_email_that_already_has_an_account_asks_to_sign_in()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var (_, token) = await factory.AddInviteAsync(grace, await EmailOfAsync(jonah));

        var response = await factory.CreateClient().PostAsJsonAsync("/api/invites/accept", new { Token = token, Name = "Jonah", Password = OidcFlow.Password });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("An account already uses this email. Sign in to accept the invite.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Theory]
    [InlineData("Ruth", "short", "Password", "Use at least 12 characters.")]
    [InlineData("", "a-long-enough-passphrase", "Name", "Enter your name.")]
    [InlineData(null, null, "Name", "Enter your name.")]
    [InlineData(101, "a-long-enough-passphrase", "Name", "Use 100 characters or fewer for your name.")]
    public async Task A_new_account_needs_a_name_and_a_valid_password(object? name, string? password, string field, string message)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var (_, token) = await factory.AddInviteAsync(grace, $"{Guid.NewGuid():N}@example.org");

        var response = await factory.CreateClient().PostAsJsonAsync("/api/invites/accept", new { Token = token, Name = name is int length ? new string('a', length) : (string?)name, Password = password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([message], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
    }

    private static async Task<Lookup?> LookUpAsync(HttpClient client, string token)
    {
        var response = await client.PostAsJsonAsync("/api/invites/lookup", new { token });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<Lookup>();
    }

    private Task<string> EmailOfAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync());

    private sealed record Lookup(string Status, string Email, string InviterName, string? InviterCity, string? PreassignedRole, bool HasAccount);
}
