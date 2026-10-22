namespace FaithTech.Community.Application.Common;

public enum ResultStatus
{
    Ok,
    Invalid,
    NotFound,
    Forbidden,
    Conflict,
    TooManyRequests,
}

/// <summary>A handler's outcome. <see cref="Detail"/> is a message for the person, shown by the web app.</summary>
/// <see cref="Extensions"/> adds fields to the problem details, such as the member a conflict names.
public record Result(
    ResultStatus Status,
    IReadOnlyDictionary<string, string[]>? Errors = null,
    string? Detail = null,
    IReadOnlyDictionary<string, object?>? Extensions = null)
{
    public static Result Ok() => new(ResultStatus.Ok);

    public static Result NotFound() => new(ResultStatus.NotFound);

    public static Result Forbidden(string? detail = null) => new(ResultStatus.Forbidden, Detail: detail);

    public static Result Conflict(string detail, IReadOnlyDictionary<string, object?>? extensions = null) =>
        new(ResultStatus.Conflict, Detail: detail, Extensions: extensions);

    public static Result TooManyRequests(string detail) => new(ResultStatus.TooManyRequests, Detail: detail);

    public static Result Invalid(string field, string message) =>
        new(ResultStatus.Invalid, new Dictionary<string, string[]> { [field] = [message] });
}
