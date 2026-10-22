using FaithTech.Community.Api.Authentication;
using FaithTech.Community.Api.Endpoints;
using FaithTech.Community.Api.Hubs;
using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Api.Middleware.PrivatePreview;
using FaithTech.Community.Application;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);
// No server banner on any response (L2-106 AC1).
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

builder.Services.AddSerilog((services, logger) => logger
    // The Serilog request log replaces ASP.NET Core's per-request events, which carry raw paths.
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .ReadFrom.Configuration(builder.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.With<LogRedaction.Enricher>()
    .WriteTo.Console());

builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
    context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier);
builder.Services.AddApplication(builder.Configuration);
// Email links are built on the web app's origin, so outside Development it must be HTTPS (L2-028 AC2).
builder.Services.AddOptions<FaithTech.Community.Application.Common.WebAppOptions>()
    .Validate(
        o => builder.Environment.IsDevelopment() || o.Origin.StartsWith("https://", StringComparison.OrdinalIgnoreCase),
        "WebApp:Origin must be an https:// URL outside Development, so every link in an email uses HTTPS.")
    .ValidateOnStart();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddCommunityAuthentication(builder.Configuration, builder.Environment);
builder.Services.AddWebProtections(builder.Configuration);
builder.Services.AddPrivatePreview(builder.Configuration);
builder.Services.AddSignalR();
builder.Services.AddScoped<SignalRAgileNotifier>();
builder.Services.AddScoped<IBoardNotifier>(sp => sp.GetRequiredService<SignalRAgileNotifier>());
builder.Services.AddScoped<IPokerBroadcaster>(sp => sp.GetRequiredService<SignalRAgileNotifier>());

var app = builder.Build();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
// Request logging sits outside the exception handler so it records the final status.
app.UseSerilogRequestLogging(options =>
{
    LogRedaction.Configure(options);
    // This host's logger rather than the static one, which another host in the process may have replaced.
    options.Logger = app.Services.GetRequiredService<Serilog.ILogger>();
});
// The wall sits before the exception handler, status code pages and routing, so a locked request reaches nothing.
app.UsePrivatePreview();
app.UseExceptionHandler();
app.UseStatusCodePages();
// Both Angular builds by host, in the production container only (L2-108).
app.UseStaticSites(app.Configuration);
app.UseCors(WebProtectionSetup.WebAppCorsPolicy);
app.UseAuthentication();
app.UseMiddleware<CurrentRolesMiddleware>();
app.UseRateLimiter();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains(FaithTech.Community.Infrastructure.DependencyInjection.ReadyTag),
}).AllowAnonymous();
app.MapMeEndpoints();
app.MapProfilesEndpoints();
app.MapAuditLogEndpoints();
app.MapRolesEndpoints();
app.MapAdminUsersEndpoints();
app.MapInvitesEndpoints();
app.MapConnectEndpoints();
app.MapContactsEndpoints();
app.MapPartnersEndpoints();
app.MapTeamEndpoints();
app.MapActivityEndpoints();
app.MapWorkspacesEndpoints();
app.MapWorkItemsEndpoints();
app.MapHub<AgileHub>("/hubs/agile");
app.MapPeopleEndpoints();
app.MapEventsEndpoints();
app.MapNotificationsEndpoints();
app.MapAnnouncementsEndpoints();
app.MapSearchEndpoints();
app.MapResourcesEndpoints();
app.MapNotesEndpoints();
app.MapAccountEndpoints();
app.MapAuthorizationEndpoints();

app.Run();

public partial class Program;
