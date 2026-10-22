using System.Security.Claims;
using FaithTech.Community.Api.Authentication;
using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Application.Common;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using FaithTech.Community.Application.Identity;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Api.Endpoints;

public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var account = app.MapGroup("/api/account").RequireRateLimiting(WebProtectionSetup.AuthRateLimitPolicy);

        account.MapPost("/sign-up", async (SignUpCommand command, SignUpHandler handler, CancellationToken ct) =>
                (await handler.HandleAsync(command, ct)).ToHttp(() => Results.Accepted()))
            .Validate<SignUpCommand>()
            .AllowAnonymous();

        account.MapPost("/verify-email", async (ConfirmEmailCommand command, ConfirmEmailHandler handler) =>
                (await handler.HandleAsync(command)).ToHttp(() => Results.Ok()))
            .Validate<ConfirmEmailCommand>()
            .AllowAnonymous();

        account.MapPost("/resend-verification", async (ResendVerificationCommand command, ResendVerificationHandler handler, CancellationToken ct) =>
                await handler.HandleAsync(command, ct)
                    ? Results.Accepted()
                    : Results.Problem(
                        "Too many verification emails have been requested. Please try again later.",
                        statusCode: StatusCodes.Status429TooManyRequests))
            .Validate<ResendVerificationCommand>()
            .AllowAnonymous();

        account.MapPost("/forgot-password", async (RequestPasswordResetCommand command, RequestPasswordResetHandler handler, CancellationToken ct) =>
                (await handler.HandleAsync(command, ct)).ToHttp(() => Results.Accepted()))
            .Validate<RequestPasswordResetCommand>()
            .AllowAnonymous();

        account.MapPost("/reset-password", async (ResetPasswordCommand command, ResetPasswordHandler handler, CancellationToken ct) =>
                (await handler.HandleAsync(command, ct)).ToHttp(() => Results.Ok()))
            .Validate<ResetPasswordCommand>()
            .AllowAnonymous();

        account.MapPost("/sign-in", SignInAsync).Validate<SignInCommand>().AllowAnonymous();
        account.MapPost("/sign-out", SignOutAsync);

        // Google sign-in for the marketing page (L2-078, ADR 0019): browser redirects, so anonymous by opt-in.
        account.MapGet("/google/start", StartGoogleSignIn).AllowAnonymous();
        account.MapGet("/google/callback", CompleteGoogleSignInAsync).AllowAnonymous();

        return app;
    }

    private static async Task<IResult> SignInAsync(
        SignInCommand command, SignInHandler handler, HttpContext context, CancellationToken ct)
    {
        var result = await handler.HandleAsync(command, ct);
        if (!result.Succeeded)
        {
            var (code, detail) = result.Error switch
            {
                SignInError.LockedOut => ("locked_out", "Too many failed attempts. Try again in 15 minutes."),
                SignInError.Suspended => ("suspended", "Your account is suspended."),
                _ => ("invalid_credentials", "Email or password is incorrect."),
            };
            return Results.Problem(detail, statusCode: StatusCodes.Status400BadRequest,
                extensions: new Dictionary<string, object?> { ["code"] = code });
        }

        var user = result.User!;
        await StartSessionAsync(context, user);
        return Results.Ok(new { EmailVerified = user.EmailConfirmed });
    }

    /// <summary>The short-lived cookie that carries a signed-in browser to /connect/authorize.</summary>
    private static Task StartSessionAsync(HttpContext context, CommunityUser user)
    {
        var identity = new ClaimsIdentity(IdentityConstants.ApplicationScheme);
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()));
        return context.SignInAsync(IdentityConstants.ApplicationScheme, new ClaimsPrincipal(identity));
    }

    private static IResult StartGoogleSignIn(
        HttpContext context,
        IGoogleIdentityProvider google,
        GoogleCorrelation correlation,
        IOptions<WebAppOptions> webApp,
        IOptions<MarketingOptions> marketing,
        string? returnUrl,
        bool? keepSignedIn)
    {
        var state = GoogleCorrelation.NewSecret();
        var nonce = GoogleCorrelation.NewSecret();
        var authorizationUrl = google.BuildAuthorizationUrl(state, nonce, GoogleRedirectUri(webApp.Value));
        if (authorizationUrl is null)
        {
            return Results.Redirect(GoogleOutcome(marketing.Value, "failed"));
        }

        correlation.Write(context, new GoogleCorrelation.Pending(state, nonce, AppPath(returnUrl), keepSignedIn ?? false));
        return Results.Redirect(authorizationUrl);
    }

    private static async Task<IResult> CompleteGoogleSignInAsync(
        HttpContext context,
        GoogleSignInHandler handler,
        GoogleCorrelation correlation,
        IOptions<WebAppOptions> webApp,
        IOptions<MarketingOptions> marketing,
        string? code,
        string? state,
        CancellationToken ct)
    {
        var pending = correlation.ReadAndClear(context);
        if (pending is null || string.IsNullOrEmpty(code) || !GoogleCorrelation.StateMatches(pending, state))
        {
            return Results.Redirect(GoogleOutcome(marketing.Value, "failed"));
        }

        var result = await handler.HandleAsync(new GoogleSignInCommand(code, GoogleRedirectUri(webApp.Value), pending.Nonce), ct);
        if (!result.Succeeded)
        {
            return Results.Redirect(GoogleOutcome(marketing.Value, result.Error == GoogleSignInError.Suspended ? "suspended" : "failed"));
        }

        await StartSessionAsync(context, result.User!);
        var keep = pending.KeepSignedIn ? "1" : "0";
        return Results.Redirect($"{webApp.Value.Origin}/auth/continue?returnUrl={Uri.EscapeDataString(pending.ReturnUrl)}&keepSignedIn={keep}");
    }

    // The API sits behind the community app's origin, so Google returns there.
    private static string GoogleRedirectUri(WebAppOptions webApp) => $"{webApp.Origin}/api/account/google/callback";

    private static string GoogleOutcome(MarketingOptions marketing, string outcome) => $"{marketing.Origin}/?google={outcome}";

    /// <summary>Only a path inside the community app is kept; anything else lands on home.</summary>
    private static string AppPath(string? url) =>
        url is not null && url.StartsWith('/') && !url.StartsWith("//") && !url.StartsWith("/\\") ? url : "/";

    private static async Task<IResult> SignOutAsync(ICurrentUser user, ITokenRevocation revocation, HttpContext context, CancellationToken ct)
    {
        await revocation.RevokeAllAsync(user.UserId!.Value, ct);
        await context.SignOutAsync(IdentityConstants.ApplicationScheme);
        return Results.NoContent();
    }
}
