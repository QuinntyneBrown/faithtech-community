using Microsoft.Extensions.Configuration;

namespace FaithTech.Community.Cli;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("Community")
            ?? throw new InvalidOperationException("ConnectionStrings:Community is not configured.");

        return await CliApp.RunAsync(args, connectionString);
    }
}
