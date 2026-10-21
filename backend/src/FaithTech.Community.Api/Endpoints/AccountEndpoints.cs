using System.Security.Claims;
using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Application.Common;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using FaithTech.Community.Application.Identity;

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
        var identity = new ClaimsIdentity(IdentityConstants.ApplicationScheme);
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()));
        await context.SignInAsync(IdentityConstants.ApplicationScheme, new ClaimsPrincipal(identity));
        return Results.Ok(new { EmailVerified = user.EmailConfirmed });
    }

    private static async Task<IResult> SignOutAsync(ICurrentUser user, ITokenRevocation revocation, HttpContext context, CancellationToken ct)
    {
        await revocation.RevokeAllAsync(user.UserId!.Value, ct);
        await context.SignOutAsync(IdentityConstants.ApplicationScheme);
        return Results.NoContent();
    }
}
