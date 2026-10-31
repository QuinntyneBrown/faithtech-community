// Traces to: L2-028
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Infrastructure.Email;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Notifications;

public partial class EmailNotificationsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private readonly CapturingTransport _transport = new();

    [Fact]
    public async Task A_published_notification_queues_its_email_in_the_same_save_and_it_is_sent_within_two_minutes()
    {
        // Given a member and a triggering action that publishes a notification with an email
        var app = OutboxApp();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var address = await EmailOfAsync(grace);

        await PublishAsync(app, grace, NotificationKind.RoleChanged, new NotificationEmail("Your roles changed", "You are now a Volunteer."));

        // Then the in-app notification and the queued email were saved together
        Assert.Equal(1, await factory.WithDbAsync(db => db.Notifications.CountAsync(n => n.RecipientId == grace.ProfileId)));
        Assert.Equal(1, await factory.WithDbAsync(db => db.OutboxMessages.CountAsync(m => m.To == address && m.SentAt == null)));

        // When the worker's next poll runs, well inside 2 minutes
        factory.Time.Advance(TimeSpan.FromSeconds(10));
        await DispatchAsync(app);

        // Then it is delivered
        var sent = Assert.Single(_transport.Delivered, m => m.To == address);
        Assert.Equal("Your roles changed", sent.Subject);
    }

    [Fact]
    public async Task Every_email_has_a_plain_text_part_and_an_html_part_whose_links_all_use_https()
    {
        var app = OutboxApp();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var address = await EmailOfAsync(grace);

        await PublishAsync(app, grace, NotificationKind.RoleChanged,
            new NotificationEmail("Your roles changed", "You are now a Volunteer."), "/people/me");
        await DispatchAsync(app);

        var sent = Assert.Single(_transport.Delivered, m => m.To == address);
        Assert.Contains("You are now a Volunteer.", sent.Body);
        Assert.Contains($"{CommunityApiFactory.WebAppOrigin}/people/me", sent.Body);
        Assert.NotNull(sent.HtmlBody);
        Assert.Contains("You are now a Volunteer.", sent.HtmlBody);
        var links = Href().Matches(sent.HtmlBody!).Select(m => m.Groups[1].Value).ToList();
        Assert.NotEmpty(links);
        Assert.All(links, link => Assert.StartsWith("https://", link));
        Assert.All(UrlInText().Matches(sent.Body).Select(m => m.Value), link => Assert.StartsWith("https://", link));
    }

    [Fact]
    public async Task Text_from_members_is_escaped_in_the_html_part()
    {
        var app = OutboxApp();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var address = await EmailOfAsync(grace);

        await PublishAsync(app, grace, NotificationKind.Announcement, new NotificationEmail("Hi", "<script>alert(1)</script> & more"));
        await DispatchAsync(app);

        var html = Assert.Single(_transport.Delivered, m => m.To == address).HtmlBody!;
        Assert.DoesNotContain("<script>", html);
        Assert.Contains("&lt;script&gt;", html);
    }

    [Fact]
    public async Task A_member_who_opted_out_gets_no_announcement_email_but_still_gets_other_emails()
    {
        // Given a member who turned announcement emails off
        var app = OutboxApp();
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.SetAnnouncementEmailOptOut(true));
        var address = await EmailOfAsync(ruth);

        // When an announcement and a role change are published to her
        await PublishAsync(app, ruth, NotificationKind.Announcement, new NotificationEmail("Builders Night moves", "New venue."));
        await PublishAsync(app, ruth, NotificationKind.RoleChanged, new NotificationEmail("Your roles changed", "You are now a Volunteer."));
        await DispatchAsync(app);

        // Then both reach her in the app, but only the role change by email
        Assert.Equal(2, await factory.WithDbAsync(db => db.Notifications.CountAsync(n => n.RecipientId == ruth.ProfileId)));
        Assert.Equal(["Your roles changed"], _transport.Delivered.Where(m => m.To == address).Select(m => m.Subject));
    }

    [Fact]
    public void The_api_refuses_to_start_when_the_web_app_origin_is_not_https_outside_development()
    {
        // The test host runs as "Testing", which is not Development.
        var app = factory.WithWebHostBuilder(b => b.UseSetting("WebApp:Origin", "http://community.example.org"));

        var error = Assert.ThrowsAny<Exception>(() => app.CreateClient());

        Assert.Contains("WebApp:Origin", error.ToString());
    }

    [Fact]
    public void Development_may_use_a_plain_http_origin()
    {
        var app = factory.WithWebHostBuilder(b => b.UseEnvironment("Development").UseSetting("WebApp:Origin", "http://localhost:4200"));

        var client = app.CreateClient();

        Assert.NotNull(client);
    }

    private WebApplicationFactory<Program> OutboxApp() =>
        factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<IEmailTransport>(_transport)));

    private static async Task PublishAsync(
        WebApplicationFactory<Program> app, ProfileClients.Member recipient, NotificationKind kind, NotificationEmail email, string link = "/announcements")
    {
        await using var scope = app.Services.CreateFaithTechScope();
        var publisher = scope.ServiceProvider.GetRequiredService<INotificationPublisher>();
        await publisher.PublishAsync([recipient.ProfileId], kind, email.Subject, link, actorId: null, _ => email);
        await scope.ServiceProvider.GetRequiredService<IApplicationDbContext>().SaveChangesAsync();
    }

    private static async Task DispatchAsync(WebApplicationFactory<Program> app)
    {
        await using var scope = app.Services.CreateFaithTechScope();
        await scope.ServiceProvider.GetRequiredService<EmailOutboxDispatcher>().DispatchPendingAsync();
    }

    private Task<string> EmailOfAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync());

    [GeneratedRegex("href=\"([^\"]*)\"")]
    private static partial Regex Href();

    [GeneratedRegex(@"\b\w+://\S+")]
    private static partial Regex UrlInText();

    private sealed class CapturingTransport : IEmailTransport
    {
        public List<EmailMessage> Delivered { get; } = [];

        public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            lock (Delivered)
            {
                Delivered.Add(message);
            }

            return Task.CompletedTask;
        }
    }
}
