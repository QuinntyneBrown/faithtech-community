using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Infrastructure.Email;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Platform;

public class EmailOutboxTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private readonly FlakyTransport _transport = new();

    [Fact]
    public async Task Sign_up_succeeds_while_email_is_down_and_the_email_is_retried_until_delivered()
    {
        var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.AddScoped<IEmailSender, OutboxEmailSender>();
            s.AddSingleton<IEmailTransport>(_transport);
        }));
        var email = $"{Guid.NewGuid():N}@example.com";
        _transport.Down = true;

        var response = await app.CreateClient().PostAsJsonAsync("/api/account/sign-up",
            new { name = "Offline", email, password = "a-long-enough-passphrase" });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.Users.AnyAsync(u => u.Email == email)));

        await DispatchAsync(app);
        Assert.Empty(_transport.Delivered);

        // Still down and not yet due: nothing is attempted again.
        _transport.Down = false;
        await DispatchAsync(app);
        Assert.Empty(_transport.Delivered);

        factory.Time.Advance(TimeSpan.FromMinutes(5));
        await DispatchAsync(app);
        Assert.Single(_transport.Delivered, m => m.To == email);

        await DispatchAsync(app);
        Assert.Single(_transport.Delivered, m => m.To == email);
    }

    [Fact]
    public async Task A_permanently_failing_email_is_tried_five_times_in_all_and_then_marked_failed()
    {
        var app = OutboxApp();
        var email = await SignUpAsync(app);
        _transport.Down = true;

        for (var i = 0; i < 10; i++)
        {
            await DispatchAsync(app);
            factory.Time.Advance(TimeSpan.FromHours(2));
        }

        Assert.Equal(5, _transport.Attempts.Count(m => m.To == email));
        var row = await factory.WithDbAsync(db => db.OutboxMessages.SingleAsync(m => m.To == email));
        Assert.Equal(5, row.Attempts);
        Assert.NotNull(row.FailedAt);
        Assert.Null(row.SentAt);
        Assert.DoesNotContain(email, row.LastError);

        _transport.Down = false;
        factory.Time.Advance(TimeSpan.FromDays(1));
        await DispatchAsync(app);
        Assert.DoesNotContain(_transport.Delivered, m => m.To == email);
    }

    [Fact]
    public async Task An_email_that_recovers_within_the_budget_is_sent_once()
    {
        var app = OutboxApp();
        var email = await SignUpAsync(app);
        _transport.Down = true;
        for (var i = 0; i < 4; i++)
        {
            await DispatchAsync(app);
            factory.Time.Advance(TimeSpan.FromHours(2));
        }

        _transport.Down = false;
        await DispatchAsync(app);
        factory.Time.Advance(TimeSpan.FromHours(2));
        await DispatchAsync(app);

        Assert.Single(_transport.Delivered, m => m.To == email);
        var row = await factory.WithDbAsync(db => db.OutboxMessages.SingleAsync(m => m.To == email));
        Assert.NotNull(row.SentAt);
        Assert.Null(row.FailedAt);
    }

    // L2-022 AC1: the RSVP confirmation keeps its .ics attachment through the outbox to the provider.
    [Fact]
    public async Task A_queued_email_keeps_its_calendar_attachment_until_it_is_sent()
    {
        var app = OutboxApp();
        var existing = await factory.AddEventAsync("Toronto Builders Night", TimeSpan.FromDays(7));
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var address = await factory.EmailOfAsync(leah);
        var client = app.WithWebHostBuilder(b => b.ConfigureServices(s => s
            .AddAuthentication(TestAuthHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null))).CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, $"{leah.UserId};");

        (await client.PostAsync($"/api/events/{existing.Id}/rsvps", null)).EnsureSuccessStatusCode();
        await DispatchAsync(app);

        var sent = Assert.Single(_transport.Delivered, m => m.To == address);
        var ics = Assert.Single(sent.Attachments!);
        Assert.Equal(("toronto-builders-night.ics", "text/calendar"), (ics.FileName, ics.ContentType));
        Assert.Contains($"UID:{existing.Id}@faithtech.community", ics.Content);
    }

    // Issue #173 AC2, AC5: both body parts, the kind, the correlation id and the .ics survive persistence, a failed
    // attempt and the retry that delivers it.
    [Fact]
    public async Task A_retried_email_keeps_its_parts_kind_correlation_and_attachment()
    {
        var app = OutboxApp();
        var existing = await factory.AddEventAsync("Builders Night <Toronto>", TimeSpan.FromDays(7));
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var address = await factory.EmailOfAsync(leah);

        (await factory.ClientFor(leah).PostAsync($"/api/events/{existing.Id}/rsvps", null)).EnsureSuccessStatusCode();
        var queued = await factory.WithDbAsync(db => db.OutboxMessages.AsNoTracking().SingleAsync(m => m.To == address));
        Assert.Equal(("RsvpConfirmed", existing.Id.ToString()), (queued.Kind, queued.CorrelationId));

        _transport.Down = true;
        await DispatchAsync(app);
        _transport.Down = false;
        factory.Time.Advance(TimeSpan.FromMinutes(5));
        await DispatchAsync(app);

        var attempts = _transport.Attempts.Where(m => m.To == address).ToList();
        Assert.Equal(2, attempts.Count);
        var sent = Assert.Single(_transport.Delivered, m => m.To == address);
        Assert.Equal(attempts[0], sent with { Attachments = attempts[0].Attachments });
        Assert.Contains("You’re going to Builders Night <Toronto>", sent.Text);
        Assert.Contains("You’re going to Builders Night &lt;Toronto&gt;", sent.Html);
        Assert.Contains($"href=\"{CommunityApiFactory.WebAppOrigin}/events/{existing.Id}\"", sent.Html);
        var ics = Assert.Single(sent.Attachments!);
        Assert.Equal(attempts[0].Attachments!.Single(), ics);
        Assert.Contains($"UID:{existing.Id}@faithtech.community", ics.Content);
    }

    private WebApplicationFactory<Program> OutboxApp() =>
        factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.AddScoped<IEmailSender, OutboxEmailSender>();
            s.AddSingleton<IEmailTransport>(_transport);
        }));

    private static async Task<string> SignUpAsync(WebApplicationFactory<Program> app)
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        (await app.CreateClient().PostAsJsonAsync("/api/account/sign-up",
            new { name = "Offline", email, password = "a-long-enough-passphrase" })).EnsureSuccessStatusCode();
        return email;
    }

    private static async Task DispatchAsync(WebApplicationFactory<Program> app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<EmailOutboxDispatcher>().DispatchPendingAsync();
    }

    private sealed class FlakyTransport : IEmailTransport
    {
        public bool Down { get; set; }

        public List<OutgoingEmail> Delivered { get; } = [];

        public List<OutgoingEmail> Attempts { get; } = [];

        public Task SendAsync(OutgoingEmail message, CancellationToken cancellationToken = default)
        {
            Attempts.Add(message);
            if (Down)
            {
                throw new InvalidOperationException($"SMTP server unavailable for {message.To}");
            }

            Delivered.Add(message);
            return Task.CompletedTask;
        }
    }
}
