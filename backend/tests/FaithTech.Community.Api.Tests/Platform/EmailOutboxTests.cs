using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Infrastructure.Email;
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

    private static async Task DispatchAsync(WebApplicationFactory<Program> app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<EmailOutboxDispatcher>().DispatchPendingAsync();
    }

    private sealed class FlakyTransport : IEmailTransport
    {
        public bool Down { get; set; }

        public List<EmailMessage> Delivered { get; } = [];

        public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            if (Down)
            {
                throw new InvalidOperationException("SMTP server unavailable");
            }

            Delivered.Add(message);
            return Task.CompletedTask;
        }
    }
}
