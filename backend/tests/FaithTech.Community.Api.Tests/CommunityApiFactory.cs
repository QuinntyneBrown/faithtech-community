using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Cli;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.Azurite;
using Testcontainers.PostgreSql;

namespace FaithTech.Community.Api.Tests;

public class CommunityApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string WebAppOrigin = "https://app.faithtech.test";

    public FakeEmailSender Emails { get; } = new();

    private readonly PostgreSqlContainer _postgres =
        new PostgreSqlBuilder("postgres:17-alpine").WithDatabase("faithtech_community").Build();

    private readonly AzuriteContainer _azurite =
        new AzuriteBuilder("mcr.microsoft.com/azure-storage/azurite:3.37.0").WithInMemoryPersistence().WithCommand("--skipApiVersionCheck").Build();

    public async Task InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(), _azurite.StartAsync());
        await CliApp.RunAsync(["migrate"], _postgres.GetConnectionString());
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Community", _postgres.GetConnectionString());
        builder.UseSetting("Cors:WebAppOrigin", WebAppOrigin);
        builder.UseSetting("ConnectionStrings:Blobs", _azurite.GetConnectionString());
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IEmailSender>(Emails);
            services.AddSingleton<IBreachedPasswordChecker, FakeBreachedPasswordChecker>();
        });
    }

    public async Task<T> WithDbAsync<T>(Func<CommunityDbContext, Task<T>> query)
    {
        await using var scope = Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<CommunityDbContext>());
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
        await _azurite.DisposeAsync();
    }
}
