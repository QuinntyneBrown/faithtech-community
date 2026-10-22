using FaithTech.Community.Application.PrivatePreview;

namespace FaithTech.Community.Api.Middleware.PrivatePreview;

public static class PrivatePreviewSetup
{
    public static IServiceCollection AddPrivatePreview(this IServiceCollection services, IConfiguration configuration)
    {
        // With the wall on, the API fails closed: no start without a full-strength hash and a 256-bit key (L2-102 AC7).
        services.AddOptions<PrivatePreviewOptions>()
            .Bind(configuration.GetSection(PrivatePreviewOptions.Section))
            .Validate<IPassphraseHasher>(
                (o, hasher) => !o.Enabled || hasher.IsUsable(o.PassphraseHash),
                "PrivatePreview:PassphraseHash must be a hash made by the Cli's wall-hash command while the wall is on.")
            .Validate(
                o => !o.Enabled || KeyBytes(o.SigningKey) >= 32,
                "PrivatePreview:SigningKey must be at least 32 random bytes in base64 (the Cli's wall-key) while the wall is on.")
            .ValidateOnStart();
        return services;
    }

    public static IApplicationBuilder UsePrivatePreview(this IApplicationBuilder app) =>
        app.UseMiddleware<PrivatePreviewGateMiddleware>();

    private static int KeyBytes(string value)
    {
        var buffer = new byte[value.Length];
        return Convert.TryFromBase64String(value, buffer, out var written) ? written : 0;
    }
}
