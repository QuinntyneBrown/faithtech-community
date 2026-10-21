namespace FaithTech.Community.Application.Common;

public class WebAppOptions
{
    public const string Section = "WebApp";

    /// <summary>Origin of the Angular web app, used for CORS and for links in emails.</summary>
    public string Origin { get; set; } = string.Empty;
}
