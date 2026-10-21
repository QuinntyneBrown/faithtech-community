using FluentValidation;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Runs the request's validator before the handler and answers 400 with per-field problem details.</summary>
public class ValidationEndpointFilter<T>(IValidator<T> validator) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var request = context.Arguments.OfType<T>().FirstOrDefault();
        if (request is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["body"] = ["A request body is required."] });
        }

        var result = await validator.ValidateAsync(request, context.HttpContext.RequestAborted);
        return result.IsValid ? await next(context) : Results.ValidationProblem(result.ToDictionary());
    }
}

public static class ValidationEndpointFilterExtensions
{
    public static RouteHandlerBuilder Validate<T>(this RouteHandlerBuilder builder) =>
        builder.AddEndpointFilter<ValidationEndpointFilter<T>>();
}
