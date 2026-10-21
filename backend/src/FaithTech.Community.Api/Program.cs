using FaithTech.Community.Api.Authentication;
using FaithTech.Community.Api.Endpoints;
using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSerilog((services, logger) => logger
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
    context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier);
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddCommunityAuthentication(builder.Configuration, builder.Environment);
builder.Services.AddWebProtections(builder.Configuration);

var app = builder.Build();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
// Request logging sits outside the exception handler so it records the final status.
app.UseSerilogRequestLogging();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors(WebProtectionSetup.WebAppCorsPolicy);
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains(DependencyInjection.ReadyTag),
}).AllowAnonymous();
app.MapMeEndpoints();

app.Run();

public partial class Program;
