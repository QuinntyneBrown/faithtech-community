using System.Text.RegularExpressions;
using FaithTech.Community.Application.Organisations;

namespace FaithTech.Community.Api.Middleware.Organisations;

public static partial class OrganisationsSetup
{
    public static IServiceCollection AddOrganisationResolution(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<PlatformOptions>()
            .Bind(configuration.GetSection(PlatformOptions.Section))
            .Validate(
                o => SlugPattern().IsMatch(o.DefaultOrganisationSlug ?? string.Empty),
                "Platform:DefaultOrganisationSlug must be an organisation slug: 3 to 40 lower-case letters, digits and hyphens.")
            .Validate(
                o => o.Operators.All(IsEmail),
                "Platform:Operators must list well-formed email addresses (L2-148 AC1).")
            .ValidateOnStart();
        return services;
    }

    /// <summary>After the wall, the exception handler and status code pages; before static files, CORS and auth.</summary>
    public static IApplicationBuilder UseOrganisationResolution(this IApplicationBuilder app) =>
        app.UseMiddleware<OrganisationResolutionMiddleware>();

    private static bool IsEmail(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && System.Net.Mail.MailAddress.TryCreate(value.Trim(), out var address)
        && address.Address == value.Trim()
        && address.Host.Contains('.');

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{2,39}$")]
    private static partial Regex SlugPattern();
}
