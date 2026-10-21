using Azure.Storage.Blobs;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
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

    // Shared by servers derived with WithWebHostBuilder, so they see the same data.
    private readonly InMemoryDatabaseRoot _databaseRoot = new();
    private readonly string _databaseName = Guid.NewGuid().ToString();

    public FakeEmailSender Emails { get; } = new();

    public FakeTimeProvider Time { get; } = new(DateTimeOffset.UtcNow);

    public FakeBlobServiceClient Blobs { get; } = new();

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
        // Tests share one client address; the rate-limit tests restore the production limit explicitly.
        builder.UseSetting("RateLimits:AuthPerMinute", "100000");
        // Tests dispatch the outbox explicitly.
        builder.UseSetting("Outbox:Enabled", "false");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IDbContextOptionsConfiguration<CommunityDbContext>>();
            services.RemoveAll<DbContextOptions<CommunityDbContext>>();
            services.AddDbContext<CommunityDbContext>(options => options
                .UseInMemoryDatabase(_databaseName, _databaseRoot)
                .UseOpenIddict());

            services.AddSingleton<BlobServiceClient>(Blobs);
            services.AddSingleton<IEmailSender>(Emails);
            services.AddSingleton<TimeProvider>(Time);
            services.AddSingleton<IBreachedPasswordChecker, FakeBreachedPasswordChecker>();
        });
    }

    public async Task<T> WithDbAsync<T>(Func<CommunityDbContext, Task<T>> query)
    {
        await using var scope = Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<CommunityDbContext>());
    }

    public new Task DisposeAsync() => base.DisposeAsync().AsTask();
}
