using System.Text.Json;
using Azure.Storage.Blobs;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Application.Resources;
using FaithTech.Community.Application.Search;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

namespace FaithTech.Community.Api.Tests;

/// <summary>Runs the API against an in-memory database and fakes for every external service.</summary>
public class CommunityApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string WebAppOrigin = "https://app.faithtech.test";

    public const string MarketingOrigin = "https://www.faithtech.test";

    /// <summary>The one account listed in <c>Platform:Operators</c> (L2-148 AC1).</summary>
    public const string OperatorEmail = "ops@platform.test";

    // Shared by servers derived with WithWebHostBuilder, so they see the same data.
    private readonly InMemoryDatabaseRoot _databaseRoot = new();
    private readonly string _databaseName = Guid.NewGuid().ToString();

    public FakeEmailSender Emails { get; } = new();

    public FakeTimeProvider Time { get; } = new(DateTimeOffset.UtcNow);

    public FakeBlobServiceClient Blobs { get; } = new();

    public FakePhotoStorage Photos { get; } = new();

    public FakeFileStorage Files { get; } = new();

    /// <summary>Lets a test overlap saves from concurrent requests.</summary>
    public SaveChangesGate SaveGate { get; } = new();

    /// <summary>Lets a test fail one save before anything is written, as a lost connection would.</summary>
    public SaveFailures SaveFailures { get; } = new();

    public FakeAgileNotifier Live { get; } = new();

    public FakeGoogleIdentityProvider Google { get; } = new();

    public async Task InitializeAsync()
    {
        await using var scope = Services.CreateOrganisationScope(FaithTechSeed.OrganisationId);
        await scope.ServiceProvider.GetRequiredService<CommunitySeeder>().SeedAsync(WebAppOrigin);

        // FaithTech's community host is the test web app's host, so requests on it resolve as they do in production;
        // localhost resolves to FaithTech as the default organisation (L2-131 AC4).
        var db = scope.ServiceProvider.GetRequiredService<CommunityDbContext>();
        var faithTech = await db.Organisations.SingleAsync(o => o.Id == FaithTechSeed.OrganisationId);
        db.Entry(faithTech).Property(o => o.Host).CurrentValue = new Uri(WebAppOrigin).Host;
        await db.SaveChangesAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Community", "Host=unused");
        builder.UseSetting("ConnectionStrings:Blobs", "UseDevelopmentStorage=true");
        builder.UseSetting("WebApp:Origin", WebAppOrigin);
        builder.UseSetting("Marketing:Origin", MarketingOrigin);
        // Tests share one client address; the rate-limit tests restore the production limit explicitly.
        builder.UseSetting("RateLimits:AuthPerMinute", "100000");
        builder.UseSetting("RateLimits:GuestRsvpPerHour", "100000");
        // Tests dispatch the outbox explicitly.
        builder.UseSetting("Outbox:Enabled", "false");
        // The private-preview wall is off, as in Development; tests/PrivatePreview turns it on (ADR 0026).
        builder.UseSetting("PrivatePreview:Enabled", "false");
        builder.UseSetting("Platform:Operators:0", OperatorEmail);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IDbContextOptionsConfiguration<CommunityDbContext>>();
            services.RemoveAll<DbContextOptions<CommunityDbContext>>();
            services.AddDbContext<CommunityDbContext>(options => options
                .UseInMemoryDatabase(_databaseName, _databaseRoot)
                .UseOpenIddict()
                .AddInterceptors(SaveGate, SaveFailures));

            services.AddSingleton<BlobServiceClient>(Blobs);
            services.AddSingleton<IEmailSender>(Emails);
            services.AddSingleton<IPhotoStorage>(Photos);
            services.AddSingleton<IFileStorage>(Files);
            services.AddSingleton<TimeProvider>(Time);
            services.AddSingleton<IBreachedPasswordChecker, FakeBreachedPasswordChecker>();
            services.AddSingleton<IBoardNotifier>(Live);
            services.AddSingleton<IPokerBroadcaster>(Live);
            services.AddSingleton<IFullTextSearch, InMemoryFullTextSearch>();
            services.AddSingleton<IGoogleIdentityProvider>(Google);
        });
    }

    /// <summary>Runs <paramref name="query"/> against FaithTech, the organisation every existing test works in.</summary>
    public Task<T> WithDbAsync<T>(Func<CommunityDbContext, Task<T>> query) => WithDbAsync(FaithTechSeed.OrganisationId, query);

    /// <summary>Runs <paramref name="query"/> with <paramref name="organisationId"/> in scope, as a request on its host would.</summary>
    public async Task<T> WithDbAsync<T>(Guid organisationId, Func<CommunityDbContext, Task<T>> query)
    {
        await using var scope = Services.CreateOrganisationScope(organisationId);
        return await query(scope.ServiceProvider.GetRequiredService<CommunityDbContext>());
    }

    /// <summary>The emails queued in the outbox for <paramref name="address"/>, oldest first, as the producer composed them.</summary>
    public Task<IReadOnlyList<EmailMessage>> QueuedEmailsToAsync(string address) =>
        QueuedEmailsToAsync(FaithTechSeed.OrganisationId, address);

    /// <summary>The emails queued in <paramref name="organisationId"/>'s outbox for <paramref name="address"/>, oldest first.</summary>
    public Task<IReadOnlyList<EmailMessage>> QueuedEmailsToAsync(Guid organisationId, string address) =>
        WithDbAsync(organisationId, async db =>
        {
            var rows = await db.OutboxMessages.Where(m => m.To == address).OrderBy(m => m.CreatedAt).ToListAsync();
            return (IReadOnlyList<EmailMessage>)rows.Select(m => new EmailMessage(
                m.To, m.Subject, m.Body,
                m.AttachmentsJson is { } json ? JsonSerializer.Deserialize<List<EmailAttachment>>(json) : null,
                m.HtmlBody)).ToList();
        });

    /// <summary>Runs the resource blob retry once, as ResourceMaintenanceWorker would after storage recovers.</summary>
    public async Task RunResourceStorageRetryAsync()
    {
        await Services.GetRequiredService<OrganisationWork>().ForEachAsync((services, _) => services.GetRequiredService<ResourceStorageRetryHandler>().RunAsync());
    }

    /// <summary>Runs the 30-day purge once, as ResourceMaintenanceWorker would.</summary>
    public async Task PurgeArchivedResourcesAsync()
    {
        await Services.GetRequiredService<OrganisationWork>().ForEachAsync((services, _) => services.GetRequiredService<PurgeArchivedResourcesHandler>().RunAsync());
    }

    public new Task DisposeAsync() => base.DisposeAsync().AsTask();
}
