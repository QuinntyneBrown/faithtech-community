namespace FaithTech.Community.Application.PrivatePreview;

public static class ReturnUrls
{
    public const int MaxLength = 2048;

    /// <summary>
    /// <paramref name="value"/> when it is a path on this host (one leading slash, no backslash or control character,
    /// at most 2,048 characters); otherwise <c>/</c>, so the unlock can never redirect off-site (L2-102 AC2).
    /// </summary>
    public static string Local(string? value) =>
        value is { Length: > 0 and <= MaxLength }
        && value[0] == '/'
        && (value.Length == 1 || (value[1] != '/' && value[1] != '\\'))
        && !value.Any(c => c == '\\' || char.IsControl(c))
            ? value
            : "/";
}
