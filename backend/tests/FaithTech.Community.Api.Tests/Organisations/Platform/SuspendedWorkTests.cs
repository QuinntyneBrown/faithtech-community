// Traces to: L2-150 AC4; L2-063 AC7
using System.Collections.Concurrent;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Organisations.Platform;

// Scheduled work skips a suspended organisation without failing it, and does it once the suspension is lifted.
public class SuspendedWorkTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private async Task SuspendAsync(string slug)
    {
        var operatorClient = await factory.OperatorClientAsync();
        (await operatorClient.PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = "Unpaid" })).EnsureSuccessStatusCode();
    }

    private async Task LiftAsync(string slug)
    {
        var operatorClient = await factory.OperatorClientAsync();
        (await operatorClient.PostAsync($"/api/platform/organisations/{slug}/lift", null)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task The_outbox_holds_a_suspended_organisations_email_unfailed_and_sends_it_after_the_lift()
    {
        var slug = $"w{Guid.NewGuid():N}"[..20];
        var other = await factory.AddOrganisationAsync(slug);
        var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<IEmailTransport, RecordingTransport>()));
        foreach (var (organisationId, to) in new[] { (other.Id, $"ana@{slug}.test"), (FaithTechSeed.OrganisationId, $"grace@{slug}.faithtech.test") })
        {
            await using var scope = app.Services.CreateOrganisationScope(organisationId);
            var db = scope.ServiceProvider.GetRequiredService<CommunityDbContext>();
            db.OutboxMessages.Add(new OutboxMessage { To = to, Subject = "Hello", Body = "Hi", CreatedAt = DateTimeOffset.UtcNow, NextAttemptAt = DateTimeOffset.MinValue });
            await db.SaveChangesAsync();
        }

        await SuspendAsync(slug);
        await DispatchAsync(app);

        var transport = (RecordingTransport)app.Services.GetRequiredService<IEmailTransport>();
        Assert.Contains($"grace@{slug}.faithtech.test", transport.Sent);
        Assert.DoesNotContain($"ana@{slug}.test", transport.Sent);
        var held = await factory.WithDbAsync(other.Id, db => db.OutboxMessages.AsNoTracking().SingleAsync(m => m.To == $"ana@{slug}.test"));
        Assert.Equal((null, null, 0), (held.SentAt, held.FailedAt, held.Attempts));

        await LiftAsync(slug);
        await DispatchAsync(app);

        Assert.Contains($"ana@{slug}.test", transport.Sent);
        Assert.NotNull((await factory.WithDbAsync(other.Id, db => db.OutboxMessages.AsNoTracking().SingleAsync(m => m.To == $"ana@{slug}.test"))).SentAt);
    }

    [Fact]
    public async Task The_purge_leaves_a_suspended_organisations_archived_resource_until_the_lift()
    {
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var id = await (await northside.PostAsync("/api/resources/links", new
        {
            Url = "https://www.canva.com/design/DAF123/edit",
            Title = Isolation.Isolation.Marker(),
            Description = "Old poster",
            Type = "template",
            Tags = new[] { "events" },
            Visibility = "Global",
        })).CreatedIdAsync();
        (await northside.PostAsJsonAsync($"/api/resources/{id}/archive", new { })).EnsureSuccessStatusCode();
        var organisation = await factory.AddOrganisationAsync();
        await SuspendAsync("northside");
        factory.Time.Advance(TimeSpan.FromDays(31));

        await factory.PurgeArchivedResourcesAsync();

        Assert.True(await factory.WithDbAsync(organisation.Id, db => db.Resources.IgnoreQueryFilters().AnyAsync(r => r.Id == id)));

        await LiftAsync("northside");
        await factory.PurgeArchivedResourcesAsync();

        Assert.False(await factory.WithDbAsync(organisation.Id, db => db.Resources.IgnoreQueryFilters().AnyAsync(r => r.Id == id)));
    }

    private static Task DispatchAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> app) =>
        app.Services.GetRequiredService<OrganisationWork>().ForEachAsync(
            (services, ct) => services.GetRequiredService<EmailOutboxDispatcher>().DispatchPendingAsync(ct));

    private sealed class RecordingTransport : IEmailTransport
    {
        public ConcurrentBag<string> Sent { get; } = [];

        public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        {
            Sent.Add(message.To);
            return Task.CompletedTask;
        }
    }
}
