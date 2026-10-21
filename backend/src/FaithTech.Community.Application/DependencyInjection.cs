using FaithTech.Community.Application.Identity;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<Common.WebAppOptions>(configuration.GetSection(Common.WebAppOptions.Section));
        services.AddValidatorsFromAssemblyContaining<SignUpValidator>();
        services.AddScoped<VerificationEmails>();
        services.AddScoped<SignUpHandler>();
        return services;
    }
}
