using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Organisations.Platform;

/// <summary>Who the platform operators are: the accounts named in <c>Platform:Operators</c> (L2-148 AC1).</summary>
public interface IPlatformOperators
{
    /// <summary>Whether <paramref name="email"/> is listed, compared without case.</summary>
    bool IsOperator(string? email);
}

public class PlatformOperators(IOptions<PlatformOptions> platform) : IPlatformOperators
{
    public bool IsOperator(string? email) =>
        !string.IsNullOrWhiteSpace(email)
        && platform.Value.Operators.Any(o => string.Equals(o.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase));
}
