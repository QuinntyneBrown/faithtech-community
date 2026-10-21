using FaithTech.Community.Application.Identity;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace FaithTech.Community.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<Common.WebAppOptions>(configuration.GetSection(Common.WebAppOptions.Section));
        services.AddValidatorsFromAssemblyContaining<SignUpValidator>();
        services.AddScoped<VerificationEmails>();
        services.AddScoped<SignUpHandler>();
        services.AddScoped<ConfirmEmailHandler>();
        services.AddScoped<ResendVerificationHandler>();
        services.AddScoped<SignInHandler>();
        services.TryAddSingleton(TimeProvider.System);
        return services;
    }
}
