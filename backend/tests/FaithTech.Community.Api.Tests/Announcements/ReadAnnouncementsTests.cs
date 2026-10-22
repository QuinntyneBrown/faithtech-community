// Traces to: L2-030
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Announcements;

public partial class ReadAnnouncementsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Theory]
    [InlineData("GET", "/api/announcements")]
    [InlineData("GET", "/api/me/announcement-email-opt-out")]
    [InlineData("PUT", "/api/me/announcement-email-opt-out")]
    public async Task Anonymous_visitor_gets_401(string method, string url)
    {
        var response = await factory.CreateClient().SendAsync(new HttpRequestMessage(new HttpMethod(method), url)
        {
            Content = method == "PUT" ? JsonContent.Create(new { OptedOut = true }) : null,
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC1: Given a member, when they open announcements, then they see the announcements sent to them, newest first.
    [Fact]
    public async Task Member_sees_the_announcements_sent_to_them_newest_first()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var sender = factory.ClientFor(hannah, Role.CommunicationsLead);
        await SendAsync(sender, "Volunteers first", ["Volunteer"]);
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        await SendAsync(sender, "Everyone second", null);
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        await SendAsync(sender, "Leads only", ["CityLead"]);

        var ruths = await factory.ClientFor(ruth).GetFromJsonAsync<AnnouncementPageResponse>("/api/announcements");
        var leahs = await factory.ClientFor(leah).GetFromJsonAsync<AnnouncementPageResponse>("/api/announcements");

        Assert.Equal(["Everyone second", "Volunteers first"], ruths!.Items.Select(a => a.Subject).Take(2));
        Assert.DoesNotContain(ruths.Items, a => a.Subject == "Leads only");
        var everyone = ruths.Items[0];
        Assert.Equal("Hannah Kim", everyone.SenderName);
        Assert.Equal("Everyone", everyone.Audience.Kind);
        Assert.Equal("Same place, new time.", everyone.Body);
        Assert.Equal(["Volunteer"], ruths.Items[1].Audience.Roles);
        Assert.Contains(leahs!.Items, a => a.Subject == "Everyone second");
        Assert.DoesNotContain(leahs.Items, a => a.Subject == "Volunteers first");
    }

    [Fact]
    public async Task The_sender_also_sees_what_they_sent_with_its_recipient_count()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var role = Role.CreateLead;
        await factory.AddMemberAsync("Samuel Mensah", p => p.AddRole(role, Guid.Empty, DateTime.UtcNow));
        var sender = factory.ClientFor(hannah, Role.CommunicationsLead);
        await SendAsync(sender, "Create leads sync", ["CreateLead"]);

        var mine = await sender.GetFromJsonAsync<AnnouncementPageResponse>("/api/announcements");

        var sent = Assert.Single(mine!.Items, a => a.Subject == "Create leads sync");
        Assert.Equal(await factory.WithDbAsync(db => db.Profiles.CountAsync(p => !p.IsSuspended && p.Roles.Any(r => r.Role == role))), sent.RecipientCount);
    }

    // AC2: Given settings, when a member turns off announcement emails, then the preference is saved and applies
    // to the next send.
    [Fact]
    public async Task Turning_announcement_emails_off_is_saved_and_applies_to_the_next_send()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var client = factory.ClientFor(ruth);
        Assert.False((await client.GetFromJsonAsync<OptOutResponse>("/api/me/announcement-email-opt-out"))!.OptedOut);

        var put = await client.PutAsJsonAsync("/api/me/announcement-email-opt-out", new { OptedOut = true });
        await SendAsync(factory.ClientFor(hannah, Role.CommunicationsLead), "After opting out", null);

        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);
        Assert.True((await client.GetFromJsonAsync<OptOutResponse>("/api/me/announcement-email-opt-out"))!.OptedOut);
        Assert.DoesNotContain(factory.Emails.SentTo(await AddressOfAsync(ruth)), m => m.Subject == "After opting out");

        await client.PutAsJsonAsync("/api/me/announcement-email-opt-out", new { OptedOut = false });
        await SendAsync(factory.ClientFor(hannah, Role.CommunicationsLead), "After opting back in", null);
        Assert.Contains(factory.Emails.SentTo(await AddressOfAsync(ruth)), m => m.Subject == "After opting back in");
    }

    // AC3: Given an announcement email, when the recipient follows its unsubscribe link, then they are opted out
    // without signing in.
    [Fact]
    public async Task The_unsubscribe_link_in_an_announcement_email_opts_out_without_signing_in()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        await SendAsync(factory.ClientFor(hannah, Role.CommunicationsLead), "With a footer", null);
        var email = factory.Emails.SentTo(await AddressOfAsync(ruth)).Single(m => m.Subject == "With a footer");
        var token = Unsubscribe().Match(email.Body).Groups["token"].Value;

        var response = await factory.CreateClient().PostAsJsonAsync("/api/announcements/unsubscribe", new { Token = Uri.UnescapeDataString(token) });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.Profiles.Where(p => p.Id == ruth.ProfileId).Select(p => p.AnnouncementEmailsOptedOut).SingleAsync()));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-token")]
    public async Task A_bad_unsubscribe_token_is_400_and_changes_nothing(string token)
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/announcements/unsubscribe", new { Token = token });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_unsubscribe_link_older_than_a_year_no_longer_works()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        await SendAsync(factory.ClientFor(hannah, Role.CommunicationsLead), "Old footer", null);
        var email = factory.Emails.SentTo(await AddressOfAsync(ruth)).Single(m => m.Subject == "Old footer");
        var token = Uri.UnescapeDataString(Unsubscribe().Match(email.Body).Groups["token"].Value);

        factory.Time.Advance(TimeSpan.FromDays(366));
        var response = await factory.CreateClient().PostAsJsonAsync("/api/announcements/unsubscribe", new { Token = token });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.Profiles.Where(p => p.Id == ruth.ProfileId).Select(p => p.AnnouncementEmailsOptedOut).SingleAsync()));
    }

    private static async Task SendAsync(HttpClient sender, string subject, string[]? roles)
    {
        var response = await sender.PostAsJsonAsync("/api/announcements", new
        {
            Subject = subject,
            Body = "Same place, new time.",
            Audience = roles is null ? (object)new { Kind = "Everyone" } : new { Kind = "Roles", Roles = roles },
        });
        response.EnsureSuccessStatusCode();
    }

    private Task<string> AddressOfAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync());

    [GeneratedRegex(@"https://app\.faithtech\.test/unsubscribe\?token=(?<token>\S+)")]
    private static partial Regex Unsubscribe();

    public sealed record AudienceResponse(string Kind, string[] Roles);

    public sealed record AnnouncementResponse(
        Guid Id, string Subject, string Body, DateTimeOffset SentAt, string SenderName, AudienceResponse Audience, int RecipientCount);

    public sealed record AnnouncementPageResponse(AnnouncementResponse[] Items, int Page, int PageSize, int TotalCount);

    public sealed record OptOutResponse(bool OptedOut);
}
