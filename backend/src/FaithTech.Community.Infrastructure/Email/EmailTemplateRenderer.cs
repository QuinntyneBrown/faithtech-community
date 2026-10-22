using System.Net;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;

namespace FaithTech.Community.Infrastructure.Email;

/// <summary>
/// Renders the HTML part of an email from its plain-text body, with the design system's <c>.email</c> pattern
/// (docs/design-system/patterns/notifications.html). Every style comes from the light-theme tokens in
/// <c>tokens.css</c>, embedded at build time, so no colour, size or font is typed here.
/// </summary>
/// <remarks>
/// The body is plain text: paragraphs are separated by a blank line; a paragraph that is only a URL becomes the
/// action button; a line "Label: URL" becomes a link named Label; any other URL becomes a link to itself.
/// </remarks>
public static partial class EmailTemplateRenderer
{
    public const string ActionLabel = "Open in FaithTech";

    private static readonly Lazy<IReadOnlyDictionary<string, string>> Tokens = new(LoadTokens);

    public static string Render(string subject, string textBody)
    {
        var email = Style(("background", "--color-bg-surface"), ("color", "--color-fg-default"), ("padding", "--space-8"), ("font", "--text-body"));
        var title = Style(("font", "--text-h4"), ("margin", "0 0 {--space-4}"));
        var text = Style(("margin", "0 0 {--space-6}"));
        var button = Style(("display", "inline-block"), ("background", "--color-accent"), ("color", "--color-fg-on-accent"),
            ("padding", "{--space-3} {--space-5}"), ("border-radius", "--radius-full"), ("font", "--text-label"), ("text-decoration", "none"));
        var link = Style(("color", "--color-accent"));
        var footer = Style(("font", "--text-caption"), ("color", "--color-fg-muted"), ("margin", "0"));

        var html = new StringBuilder();
        html.Append("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>")
            .Append(WebUtility.HtmlEncode(subject))
            .Append("</title></head><body style=\"margin:0\">")
            .Append($"<div class=\"email\" style=\"{email}\">")
            .Append($"<p class=\"email__title\" style=\"{title}\">{WebUtility.HtmlEncode(subject)}</p>");
        foreach (var paragraph in Paragraphs(textBody))
        {
            if (WholeUrl().IsMatch(paragraph))
            {
                html.Append($"<p class=\"email__action\" style=\"{text}\"><a class=\"email__button\" style=\"{button}\" href=\"{WebUtility.HtmlEncode(paragraph)}\">{ActionLabel}</a></p>");
            }
            else
            {
                var lines = paragraph.Split('\n').Select(line => Line(line, link));
                html.Append($"<p class=\"email__text\" style=\"{text}\">{string.Join("<br>", lines)}</p>");
            }
        }

        html.Append($"<p class=\"email__footer\" style=\"{footer}\">FaithTech Community</p></div></body></html>");
        return html.ToString();
    }

    private static IEnumerable<string> Paragraphs(string body) =>
        body.Replace("\r\n", "\n").Split("\n\n").Select(p => p.Trim()).Where(p => p.Length > 0);

    private static string Line(string line, string linkStyle)
    {
        var labelled = LabelledUrl().Match(line);
        if (labelled.Success)
        {
            return $"<a style=\"{linkStyle}\" href=\"{WebUtility.HtmlEncode(labelled.Groups[2].Value)}\">{WebUtility.HtmlEncode(labelled.Groups[1].Value)}</a>";
        }

        var result = new StringBuilder();
        var last = 0;
        foreach (Match url in AnyUrl().Matches(line))
        {
            result.Append(WebUtility.HtmlEncode(line[last..url.Index]));
            var encoded = WebUtility.HtmlEncode(url.Value);
            result.Append($"<a style=\"{linkStyle}\" href=\"{encoded}\">{encoded}</a>");
            last = url.Index + url.Length;
        }

        return result.Append(WebUtility.HtmlEncode(line[last..])).ToString();
    }

    /// <summary>Builds an inline style. A value naming a token ("--space-4") or holding "{--token}" is resolved.</summary>
    private static string Style(params (string Property, string Value)[] rules) =>
        string.Join(";", rules.Select(r => $"{r.Property}:{WebUtility.HtmlEncode(Value(r.Value))}"));

    private static string Value(string value) =>
        value.StartsWith("--", StringComparison.Ordinal)
            ? Resolve(value)
            : Braced().Replace(value, m => Resolve(m.Groups[1].Value));

    private static string Resolve(string token, int depth = 0)
    {
        if (depth > 10 || !Tokens.Value.TryGetValue(token, out var raw))
        {
            throw new InvalidOperationException($"The design token {token} is not defined in tokens.css.");
        }

        return VarReference().Replace(raw, m => Resolve(m.Groups[1].Value, depth + 1)).Trim();
    }

    /// <summary>The custom properties of the first <c>:root</c> block of tokens.css, the light theme.</summary>
    private static IReadOnlyDictionary<string, string> LoadTokens()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("FaithTech.Community.Infrastructure.Email.tokens.css")
            ?? throw new InvalidOperationException("tokens.css is not embedded in the Infrastructure assembly.");
        using var reader = new StreamReader(stream);
        var css = Comment().Replace(reader.ReadToEnd(), string.Empty);
        var start = css.IndexOf(":root {", StringComparison.Ordinal);
        var root = css[start..css.IndexOf('}', start)];
        return Declaration().Matches(root).ToDictionary(m => m.Groups[1].Value, m => m.Groups[2].Value.Trim());
    }

    [GeneratedRegex(@"^https://\S+$")]
    private static partial Regex WholeUrl();

    [GeneratedRegex(@"^(.+?):\s+(https://\S+)$")]
    private static partial Regex LabelledUrl();

    [GeneratedRegex(@"https?://\S+")]
    private static partial Regex AnyUrl();

    [GeneratedRegex(@"\{(--[a-z0-9-]+)\}")]
    private static partial Regex Braced();

    [GeneratedRegex(@"var\((--[a-z0-9-]+)\)")]
    private static partial Regex VarReference();

    [GeneratedRegex(@"/\*.*?\*/", RegexOptions.Singleline)]
    private static partial Regex Comment();

    [GeneratedRegex(@"(--[a-z0-9-]+)\s*:\s*([^;]+);")]
    private static partial Regex Declaration();
}
