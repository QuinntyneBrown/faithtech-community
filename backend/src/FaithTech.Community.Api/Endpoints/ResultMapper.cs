using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Api.Endpoints;

public static class ResultMapper
{
    public static IResult ToHttp(this Result result, Func<IResult> onOk) => result.Status switch
    {
        ResultStatus.Ok => onOk(),
        ResultStatus.Invalid => Results.ValidationProblem(result.Errors!.ToDictionary()),
        ResultStatus.NotFound => Results.NotFound(),
        ResultStatus.Forbidden when result.Detail is null => Results.Forbid(),
        ResultStatus.Forbidden => Results.Problem(result.Detail, statusCode: StatusCodes.Status403Forbidden),
        ResultStatus.Conflict => Results.Problem(result.Detail, statusCode: StatusCodes.Status409Conflict),
        ResultStatus.TooManyRequests => Results.Problem(result.Detail, statusCode: StatusCodes.Status429TooManyRequests),
        _ => throw new ArgumentOutOfRangeException(nameof(result)),
    };
}
