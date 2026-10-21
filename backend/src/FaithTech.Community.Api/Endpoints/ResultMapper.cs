using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Api.Endpoints;

public static class ResultMapper
{
    public static IResult ToHttp(this Result result, Func<IResult> onOk) => result.Status switch
    {
        ResultStatus.Ok => onOk(),
        ResultStatus.Invalid => Results.ValidationProblem(result.Errors!.ToDictionary()),
        ResultStatus.NotFound => Results.NotFound(),
        ResultStatus.Forbidden => Results.Forbid(),
        _ => throw new ArgumentOutOfRangeException(nameof(result)),
    };
}
