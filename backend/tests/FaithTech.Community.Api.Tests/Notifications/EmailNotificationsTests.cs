// Traces to: L2-028
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Email;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Notifications;

public partial class EmailNotificationsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    // AC1: Given a triggering action, when it completes, then the email is queued and sent within 2 minutes,
    // retrying on failure up to 5 times. The retry budget itself is proven in Platform/EmailOutboxTests.
    [Fact]
    public async Task A_triggered_email_is_queued_with_the_action_and_delivered_on_the_next_dispatch()
    {
        var transport = new CountingTransport();
        var app = WithOutbox(transport);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        await PublishAsync(app, [ruth.ProfileId], NotificationKind.RoleChanged);

        var queued = await factory.WithDbAsync(db => db.OutboxMessages.SingleAsync(m => m.To == AddressOf(ruth)));
        Assert.Null(queued.SentAt);
        Assert.True(queued.NextAttemptAt <= factory.Time.GetUtcNow(), "due at once");
        await DispatchAsync(app);
        Assert.Single(transport.Delivered, m => m.To == AddressOf(ruth));
    }

    // AC2: Given an email, when it is rendered, then it includes a plain-text part, and every link uses HTTPS.
    [Fact]
    public async Task A_role_change_email_is_plain_text_whose_links_all_use_https()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { Role = "Volunteer" });

        response.EnsureSuccessStatusCode();
        var email = Assert.Single(factory.Emails.SentTo(AddressOf(ruth)));
        Assert.Equal("Your FaithTech Community roles changed", email.Subject);
        Assert.Contains("Grace Okonkwo added the Volunteer role to your profile", email.Body);
        var links = Links().Matches(email.Body).Select(m => m.Value).ToList();
        Assert.Equal([$"{CommunityApiFactory.WebAppOrigin}/people/me"], links);
        var notice = await factory.WithDbAsync(db => db.Notifications.SingleAsync(n => n.RecipientId == ruth.ProfileId));
        Assert.Equal("Grace Okonkwo", notice.ActorName);
    }

    // AC3: Given a user who opted out of announcement emails, when an announcement is sent, then no
    // announcement email reaches them, but other notification emails still do.
    [Fact]
    public async Task Opting_out_stops_announcement_emails_only_and_never_the_in_app_notification()
    {
        var optedOut = await factory.AddMemberAsync("Leah Thompson", p => p.SetAnnouncementEmailOptOut(true));
        var subscribed = await factory.AddMemberAsync("Ruth Alvarez");
        var app = factory.WithWebHostBuilder(_ => { });

        await PublishAsync(app, [optedOut.ProfileId, subscribed.ProfileId], NotificationKind.Announcement);
        await PublishAsync(app, [optedOut.ProfileId], NotificationKind.RoleChanged);

        Assert.Equal(["Announcement"], factory.Emails.SentTo(AddressOf(subscribed)).Select(m => m.Subject));
        Assert.Equal(["Role changed"], factory.Emails.SentTo(AddressOf(optedOut)).Select(m => m.Subject));
        var kinds = await factory.WithDbAsync(db =>
            db.Notifications.Where(n => n.RecipientId == optedOut.ProfileId).Select(n => n.Kind).ToListAsync());
        Assert.Equal([NotificationKind.RoleChanged, NotificationKind.Announcement], kinds.Order());
    }

    [Fact]
    public async Task Each_recipient_gets_their_own_footer()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var app = factory.WithWebHostBuilder(_ => { });

        await PublishAsync(app, [ruth.ProfileId], NotificationKind.Announcement, footer: id => $"Footer for {id}");

        Assert.EndsWith($"Footer for {ruth.ProfileId}", factory.Emails.SentTo(AddressOf(ruth)).Single().Body);
    }

    private WebApplicationFactory<Program> WithOutbox(IEmailTransport transport) =>
        factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.AddScoped<IEmailSender, OutboxEmailSender>();
            s.AddSingleton(transport);
        }));

    private static async Task PublishAsync(
        WebApplicationFactory<Program> app, Guid[] recipients, NotificationKind kind, Func<Guid, string>? footer = null)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var subject = kind == NotificationKind.Announcement ? "Announcement" : "Role changed";
        await scope.ServiceProvider.GetRequiredService<INotificationPublisher>().PublishAsync(
            recipients, kind, subject, "/announcements", "Hannah Kim", new NotificationEmail(subject, $"{subject}.", footer));
    }

    private static async Task DispatchAsync(WebApplicationFactory<Program> app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<EmailOutboxDispatcher>().DispatchPendingAsync();
    }

    private string AddressOf(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync()).GetAwaiter().GetResult();

    [GeneratedRegex(@"\b\w+://\S+")]
    private static partial Regex Links();

    private sealed class CountingTransport : IEmailTransport
    {
        public int FailuresLeft { get; set; }

        public List<string> Attempts { get; } = [];

        public List<EmailMessage> Delivered { get; } = [];

        public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            lock (this)
            {
                Attempts.Add(message.To);
                if (FailuresLeft > 0)
                {
                    FailuresLeft--;
                    throw new InvalidOperationException("SMTP server unavailable");
                }

                Delivered.Add(message);
            }

            return Task.CompletedTask;
        }
    }
}
