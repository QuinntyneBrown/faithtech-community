using System.Security.Cryptography;
using System.Text;
using FaithTech.Community.Application.Identity;
using Microsoft.Extensions.Logging;

namespace FaithTech.Community.Infrastructure.Identity;

/// <summary>
/// Checks the Pwned Passwords range API. Only the first five characters of the SHA-1 hash leave the server.
/// </summary>
public class HibpBreachedPasswordChecker(HttpClient http, ILogger<HibpBreachedPasswordChecker> logger) : IBreachedPasswordChecker
{
    public async Task<bool> IsBreachedAsync(string password, CancellationToken cancellationToken = default)
    {
        var hash = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(password)));
        var (prefix, suffix) = (hash[..5], hash[5..]);

        try
        {
            var body = await http.GetStringAsync($"range/{prefix}", cancellationToken);
            return body.Split('\n').Any(line => line.StartsWith(suffix + ":", StringComparison.OrdinalIgnoreCase));
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            // Fail open: an outage of the breach service must not block sign-up or password reset.
            logger.LogWarning(exception, "Breached-password check unavailable");
            return false;
        }
    }
}
