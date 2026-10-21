namespace FaithTech.Community.Application.Common;

public class WebAppOptions
{
    public const string Section = "WebApp";

    /// <summary>Origin of the Angular web app, used for CORS and for links in emails.</summary>
    public string Origin { get; set; } = string.Empty;

    /// <summary>Email links must use HTTPS (L2-028 AC2); plain HTTP is allowed only on this machine, for development.</summary>
    public static bool IsSafeLinkOrigin(string origin) =>
        Uri.TryCreate(origin, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback));
}
