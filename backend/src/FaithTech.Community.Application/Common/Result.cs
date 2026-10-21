namespace FaithTech.Community.Application.Common;

public enum ResultStatus
{
    Ok,
    Invalid,
    NotFound,
    Forbidden,
}

public record Result(ResultStatus Status, IReadOnlyDictionary<string, string[]>? Errors = null)
{
    public static Result Ok() => new(ResultStatus.Ok);

    public static Result NotFound() => new(ResultStatus.NotFound);

    public static Result Forbidden() => new(ResultStatus.Forbidden);

    public static Result Invalid(string field, string message) =>
        new(ResultStatus.Invalid, new Dictionary<string, string[]> { [field] = [message] });
}
