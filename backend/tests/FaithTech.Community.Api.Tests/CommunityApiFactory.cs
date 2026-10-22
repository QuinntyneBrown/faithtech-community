using System.Text.Json;
using Azure.Storage.Blobs;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Application.Resources;
using FaithTech.Community.Application.Search;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Persistence;
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
        await using var scope = Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<CommunitySeeder>().SeedAsync(WebAppOrigin);
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

    public async Task<T> WithDbAsync<T>(Func<CommunityDbContext, Task<T>> query)
    {
        await using var scope = Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<CommunityDbContext>());
    }

    /// <summary>The emails queued in the outbox for <paramref name="address"/>, oldest first, as the producer composed them.</summary>
    public Task<IReadOnlyList<EmailMessage>> QueuedEmailsToAsync(string address) =>
        WithDbAsync(async db =>
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
        await using var scope = Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ResourceStorageRetryHandler>().RunAsync();
    }

    /// <summary>Runs the 30-day purge once, as ResourceMaintenanceWorker would.</summary>
    public async Task PurgeArchivedResourcesAsync()
    {
        await using var scope = Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<PurgeArchivedResourcesHandler>().RunAsync();
    }

    public new Task DisposeAsync() => base.DisposeAsync().AsTask();
}
