namespace FaithTech.Community.Application.Common;

public class MarketingOptions
{
    public const string Section = "Marketing";

    /// <summary>Origin of the marketing page (www.faithtech.community), allowed by CORS and used for Google sign-in outcomes.</summary>
    public string Origin { get; set; } = string.Empty;
}
