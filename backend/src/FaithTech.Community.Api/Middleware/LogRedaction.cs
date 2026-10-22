using System.Text.RegularExpressions;
using Serilog.AspNetCore;
using Serilog.Core;
using Serilog.Events;

namespace FaithTech.Community.Api.Middleware;

/// <summary>
/// Keeps credentials that can appear in a request path out of the logs (L2-043, L2-047 AC2). Credentials
/// travel in request bodies, which are never logged; this guards paths that a stale or hostile client
/// still sends, such as the retired <c>GET /api/invites/by-token/{token}</c>.
/// </summary>
public static partial class LogRedaction
{
    public const string Redacted = "[redacted]";

    public static string RedactPath(string path) => CredentialSegment().Replace(path, $"$1{Redacted}");

    /// <summary>The request log properties, with the path redacted; method, status and duration are kept.</summary>
    public static void Configure(RequestLoggingOptions options) =>
        options.GetMessageTemplateProperties = (context, path, elapsed, status) =>
        [
            new LogEventProperty("RequestMethod", new ScalarValue(context.Request.Method)),
            new LogEventProperty("RequestPath", new ScalarValue(RedactPath(path))),
            new LogEventProperty("StatusCode", new ScalarValue(status)),
            new LogEventProperty("Elapsed", new ScalarValue(elapsed)),
        ];

    [GeneratedRegex(@"(/by-token/)[^/?#]+", RegexOptions.IgnoreCase)]
    private static partial Regex CredentialSegment();

    /// <summary>Redacts the <c>RequestPath</c> and <c>Path</c> properties ASP.NET Core adds to its log scopes.</summary>
    public sealed class Enricher : ILogEventEnricher
    {
        private static readonly string[] PathProperties = ["RequestPath", "Path"];

        public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
        {
            foreach (var name in PathProperties)
            {
                if (logEvent.Properties.TryGetValue(name, out var value)
                    && value is ScalarValue { Value: string path }
                    && RedactPath(path) is var redacted && redacted != path)
                {
                    logEvent.AddOrUpdateProperty(new LogEventProperty(name, new ScalarValue(redacted)));
                }
            }
        }
    }
}
