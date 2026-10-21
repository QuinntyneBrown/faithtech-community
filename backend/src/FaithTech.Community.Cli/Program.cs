using FaithTech.Community.Cli;
using Microsoft.Extensions.Configuration;

var configuration = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

var connectionString = configuration.GetConnectionString("Community")
    ?? throw new InvalidOperationException("ConnectionStrings:Community is not configured.");

return await CliApp.RunAsync(args, connectionString);
