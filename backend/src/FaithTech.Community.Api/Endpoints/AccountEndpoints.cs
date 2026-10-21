using FaithTech.Community.Api.Middleware;
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

        return app;
    }
}
