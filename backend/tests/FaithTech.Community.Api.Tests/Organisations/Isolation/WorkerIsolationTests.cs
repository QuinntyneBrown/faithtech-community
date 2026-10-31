using System.Collections.Concurrent;
using System.Net.Http.Json;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Organisations;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Organisations.Isolation;

// Traces to: L2-130 AC1, AC2. The workers run once per organisation, each with that organisation in scope, so every
// row is processed and written under the organisation it belongs to.
public class WorkerIsolationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_outbox_sends_every_organisations_queued_email()
    {
        var northside = await factory.AddOrganisationAsync();
        var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<IEmailTransport, RecordingTransport>()));
        foreach (var (organisationId, to) in new[] { (northside.Id, "ana@northside.test"), (Infrastructure.Persistence.Seed.FaithTechSeed.OrganisationId, "grace@faithtech.test") })
        {
            await using var scope = app.Services.CreateOrganisationScope(organisationId);
            var db = scope.ServiceProvider.GetRequiredService<Infrastructure.Persistence.CommunityDbContext>();
            db.OutboxMessages.Add(new OutboxMessage { To = to, Subject = "Hello", Body = "Hi", CreatedAt = DateTimeOffset.UtcNow, NextAttemptAt = DateTimeOffset.MinValue });
            await db.SaveChangesAsync();
        }

        await app.Services.GetRequiredService<OrganisationWork>().ForEachAsync(
            (services, ct) => services.GetRequiredService<EmailOutboxDispatcher>().DispatchPendingAsync(ct));

        var transport = (RecordingTransport)app.Services.GetRequiredService<IEmailTransport>();
        Assert.Contains("ana@northside.test", transport.Sent);
        Assert.Contains("grace@faithtech.test", transport.Sent);
        Assert.True(await factory.WithDbAsync(northside.Id, db => db.OutboxMessages.Where(m => m.To == "ana@northside.test").AllAsync(m => m.SentAt != null)));
    }

    [Fact]
    public async Task The_purge_removes_another_organisations_resource_archived_30_days_ago()
    {
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var id = await (await northside.PostAsync("/api/resources/links", new
        {
            Url = "https://www.canva.com/design/DAF123/edit", Title = Isolation.Marker(), Description = "Old poster", Type = "Template",
            Tags = new[] { "events" }, Visibility = "Global",
        })).CreatedIdAsync();
        (await northside.PostAsJsonAsync($"/api/resources/{id}/archive", new { })).EnsureSuccessStatusCode();
        var organisation = await factory.AddOrganisationAsync();

        factory.Time.Advance(TimeSpan.FromDays(31));
        await factory.PurgeArchivedResourcesAsync();

        Assert.False(await factory.WithDbAsync(organisation.Id, db => db.Resources.AnyAsync(r => r.Id == id)));
    }

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
