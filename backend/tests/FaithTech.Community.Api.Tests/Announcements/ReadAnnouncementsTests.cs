// Traces to: L2-030, L2-042
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using System.Web;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Announcements;

public partial class ReadAnnouncementsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Item(
        Guid Id, string Subject, string Body, DateTimeOffset SentAt, string SenderName, string AudienceKind,
        string[] Roles, string? EventTitle, int RecipientCount);

    public sealed record AnnouncementPage(Item[] Items, int Page, int PageSize, int TotalCount);

    public sealed record OptOut(bool OptedOut);

    [Fact]
    public async Task A_member_sees_the_announcements_sent_to_them_newest_first()
    {
        // Given two announcements to volunteers, one to attendees, sent a day apart
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));
        var sender = factory.ClientFor(hannah, Role.CommunicationsLead);
        await SendAsync(sender, "First for volunteers", Roles("Volunteer"));
        factory.Time.Advance(TimeSpan.FromDays(1));
        await SendAsync(sender, "For attendees", Roles("Attendee"));
        factory.Time.Advance(TimeSpan.FromDays(1));
        await SendAsync(sender, "Second for volunteers", Roles("Volunteer"));

        // When Ruth opens announcements
        var page = (await factory.ClientFor(ruth).GetFromJsonAsync<AnnouncementPage>("/api/announcements"))!;

        // Then she sees the two sent to her, newest first, with who sent them and to whom
        Assert.Equal(["Second for volunteers", "First for volunteers"], page.Items.Select(i => i.Subject));
        var latest = page.Items[0];
        Assert.Equal(("Hannah Kim", "Roles", "Body of Second for volunteers"), (latest.SenderName, latest.AudienceKind, latest.Body));
        Assert.Equal(["Volunteer"], latest.Roles);
        Assert.True(latest.RecipientCount >= 1);
    }

    [Fact]
    public async Task A_sender_also_sees_what_they_sent_to_others()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var sender = factory.ClientFor(hannah, Role.CommunicationsLead);
        await SendAsync(sender, "Only for Staff", Roles("Staff"));

        var page = (await sender.GetFromJsonAsync<AnnouncementPage>("/api/announcements"))!;

        Assert.Contains(page.Items, i => i.Subject == "Only for Staff");
    }

    [Fact]
    public async Task Turning_announcement_emails_off_is_saved_and_applies_to_the_next_send()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.ProductEngineer, Guid.Empty, DateTime.UtcNow));
        var client = factory.ClientFor(ruth);
        Assert.Equal(new OptOut(false), await client.GetFromJsonAsync<OptOut>("/api/me/announcement-email-opt-out"));

        var response = await client.PutAsJsonAsync("/api/me/announcement-email-opt-out", new { OptedOut = true });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(new OptOut(true), await client.GetFromJsonAsync<OptOut>("/api/me/announcement-email-opt-out"));
        await SendAsync(factory.ClientFor(hannah, Role.CommunicationsLead), "After opting out", Roles("ProductEngineer"));
        Assert.Empty(await EmailsToAsync(ruth, "After opting out"));
    }

    [Fact]
    public async Task The_unsubscribe_link_in_an_announcement_email_opts_the_recipient_out_without_signing_in()
    {
        // Given an announcement email
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Attendee, Guid.Empty, DateTime.UtcNow));
        await SendAsync(factory.ClientFor(hannah, Role.CommunicationsLead), "Builders Night", Roles("Attendee"));
        var email = Assert.Single(await EmailsToAsync(ruth, "Builders Night"));
        var link = UnsubscribeLink().Match(email.Body);
        Assert.True(link.Success, email.Body);
        Assert.StartsWith($"{CommunityApiFactory.WebAppOrigin}/unsubscribe?token=", link.Value);

        // When the recipient follows it, with no session
        var token = HttpUtility.ParseQueryString(new Uri(link.Value).Query)["token"];
        var response = await factory.CreateClient().PostAsJsonAsync("/api/announcements/unsubscribe", new { Token = token });

        // Then they are opted out
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.Profiles.Where(p => p.Id == ruth.ProfileId).Select(p => p.AnnouncementEmailsOptedOut).SingleAsync()));
    }

    [Fact]
    public async Task A_tampered_or_made_up_token_is_refused()
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/announcements/unsubscribe", new { Token = "not-a-token" });
        var empty = await factory.CreateClient().PostAsJsonAsync("/api/announcements/unsubscribe", new { Token = "" });

        Assert.Equal((HttpStatusCode.BadRequest, HttpStatusCode.BadRequest), (response.StatusCode, empty.StatusCode));
    }

    [Fact]
    public async Task An_unsubscribe_link_older_than_a_year_is_refused()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.CreateLead, Guid.Empty, DateTime.UtcNow));
        await SendAsync(factory.ClientFor(hannah, Role.CommunicationsLead), "Old news", Roles("CreateLead"));
        var token = HttpUtility.ParseQueryString(new Uri(UnsubscribeLink().Match(Assert.Single(await EmailsToAsync(ruth, "Old news")).Body).Value).Query)["token"];
        factory.Time.Advance(TimeSpan.FromDays(366));

        var response = await factory.CreateClient().PostAsJsonAsync("/api/announcements/unsubscribe", new { Token = token });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.Profiles.Where(p => p.Id == ruth.ProfileId).Select(p => p.AnnouncementEmailsOptedOut).SingleAsync()));
    }

    [Fact]
    public async Task A_token_from_another_purpose_cannot_unsubscribe_anyone()
    {
        // An invite token is a signed value too, but it was never issued for unsubscribing.
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var (_, inviteToken) = await FaithTech.Community.Api.Tests.Invites.InviteClients.AddInviteAsync(factory, grace, $"{Guid.NewGuid():N}@example.org");

        var response = await factory.CreateClient().PostAsJsonAsync("/api/announcements/unsubscribe", new { Token = inviteToken });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static object Roles(params string[] roles) => new { Kind = "Roles", Roles = roles };

    private static async Task SendAsync(HttpClient sender, string subject, object audience)
    {
        var response = await sender.PostAsJsonAsync("/api/announcements",
            new { Subject = subject, Body = $"Body of {subject}", AlsoEmail = true, Audience = audience });
        response.EnsureSuccessStatusCode();
    }

    private Task<List<Infrastructure.Email.OutboxMessage>> EmailsToAsync(ProfileClients.Member member, string subject) =>
        factory.WithDbAsync(async db =>
        {
            var address = await db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email).SingleAsync();
            return await db.OutboxMessages.Where(m => m.To == address && m.Subject == subject).ToListAsync();
        });

    [GeneratedRegex(@"https://\S+/unsubscribe\?token=\S+")]
    private static partial Regex UnsubscribeLink();
}
