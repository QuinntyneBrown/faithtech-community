using System.Net;
using System.Text;
using FaithTech.Community.Application.Common;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Infrastructure.Email;

/// <summary>An email ready for the provider: both body alternatives and its attachments.</summary>
public record OutgoingEmail(string To, string Subject, string Text, string Html, IReadOnlyList<EmailAttachment>? Attachments = null);

/// <summary>
/// Renders <see cref="EmailContent"/> into the plain-text part and the branded HTML alternative of
/// docs/mocks/notifications/email (L2-028 AC2). The HTML inlines the design system's <c>.email</c> rules
/// (docs/design-system/assets/components.css) with the light-theme token values below, so a template never types a
/// colour, size or font. User text is escaped, and every link joins an app path to <c>WebApp:Origin</c>, which must
/// be https (plain http only on this machine).
/// </summary>
public class EmailTemplateRenderer(IOptions<WebAppOptions> webApp)
{
    public const string Brand = "FaithTech Community";
    public const string StandardFooter = "You can turn off announcement emails in Settings; account and activity emails are always sent.";
    public const string UnsubscribeLabel = "Unsubscribe from announcement emails";

    // Light-theme values of docs/design-system/tokens/tokens.css; email clients cannot read CSS variables.
    private static readonly Dictionary<string, string> Tokens = new()
    {
        ["color-bg-surface"] = "#ffffff",
        ["color-fg-default"] = "#1a1e26",
        ["color-fg-muted"] = "#5e6675",
        ["color-accent"] = "#7c3aed",
        ["color-fg-on-accent"] = "#ffffff",
        ["space-3"] = "12px",
        ["space-4"] = "16px",
        ["space-5"] = "20px",
        ["space-6"] = "24px",
        ["space-8"] = "32px",
        ["radius-full"] = "9999px",
        ["font-family-sans"] = "ui-rounded,'SF Pro Rounded','Nunito','Segoe UI',system-ui,-apple-system,Roboto,'Helvetica Neue',Arial,sans-serif",
        ["text-body"] = "400 16px/1.5",
        ["text-h4"] = "600 20px/1.3",
        ["text-label"] = "500 14px/1.5",
        ["text-caption"] = "400 12px/1.5",
    };

    // The .email rules of components.css, written against the tokens above.
    private static readonly string EmailStyle = Style("background:{color-bg-surface};color:{color-fg-default};padding:{space-8};font:{text-body} {font-family-sans}");
    private static readonly string TitleStyle = Style("font:{text-h4} {font-family-sans};margin:0 0 {space-4}");
    private static readonly string TextStyle = Style("margin:0 0 {space-6}");
    private static readonly string ButtonStyle = Style("display:inline-block;background:{color-accent};color:{color-fg-on-accent};padding:{space-3} {space-5};border-radius:{radius-full};font:{text-label} {font-family-sans};text-decoration:none");
    private static readonly string FooterStyle = Style("font:{text-caption} {font-family-sans};color:{color-fg-muted};margin:0");

    public (string Text, string Html) Render(EmailMessage message)
    {
        var content = message.Content;
        var action = content.Action is { } a ? (a.Label, Url: Link(a.Path)) : default;
        var secondary = content.SecondaryAction is { } b ? (b.Label, Url: Link(b.Path)) : default;
        var unsubscribe = content.UnsubscribePath is { } path ? Link(path) : null;

        var text = new StringBuilder();
        text.Append(content.Title).Append("\n\n");
        foreach (var paragraph in content.Paragraphs)
        {
            text.Append(paragraph).Append("\n\n");
        }

        if (action.Url is not null)
        {
            text.Append(action.Label).Append(":\n").Append(action.Url).Append("\n\n");
        }

        if (secondary.Url is not null)
        {
            text.Append(secondary.Label).Append(":\n").Append(secondary.Url).Append("\n\n");
        }

        text.Append("—\n").Append(Brand).Append(" · ");
        text.Append(unsubscribe is null ? StandardFooter : $"{UnsubscribeLabel} (no sign-in needed):\n{unsubscribe}");

        var html = new StringBuilder();
        html.Append("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>")
            .Append(Encode(message.Subject))
            .Append("</title></head><body style=\"margin:0\"><div class=\"email\" style=\"").Append(EmailStyle).Append("\">");
        html.Append("<p class=\"email__title\" style=\"").Append(TitleStyle).Append("\">").Append(Encode(content.Title)).Append("</p>");
        foreach (var paragraph in content.Paragraphs)
        {
            html.Append("<p class=\"email__text\" style=\"").Append(TextStyle).Append("\">")
                .Append(Encode(paragraph).Replace("\n", "<br>", StringComparison.Ordinal)).Append("</p>");
        }

        if (action.Url is not null)
        {
            html.Append("<p class=\"email__action\" style=\"").Append(TextStyle).Append("\"><a class=\"email__button\" style=\"")
                .Append(ButtonStyle).Append("\" href=\"").Append(Encode(action.Url)).Append("\">").Append(Encode(action.Label)).Append("</a></p>");
        }

        if (secondary.Url is not null)
        {
            html.Append("<p class=\"email__text\" style=\"").Append(TextStyle).Append("\"><a style=\"color:inherit\" href=\"")
                .Append(Encode(secondary.Url)).Append("\">").Append(Encode(secondary.Label)).Append("</a></p>");
        }

        html.Append("<p class=\"email__footer\" style=\"").Append(FooterStyle).Append("\">").Append(Brand).Append(" · ");
        html.Append(unsubscribe is null
            ? Encode(StandardFooter)
            : $"<a style=\"color:inherit\" href=\"{Encode(unsubscribe)}\">{UnsubscribeLabel}</a> (no sign-in needed).");
        html.Append("</p></div></body></html>");
        return (text.ToString(), html.ToString());
    }

    /// <summary>An app path joined to the configured origin; anything else is a programming error, never an insecure link.</summary>
    private string Link(string path)
    {
        var origin = webApp.Value.Origin;
        if (!WebAppOptions.IsSafeLinkOrigin(origin))
        {
            throw new InvalidOperationException("WebApp:Origin must be an https URL (or http on localhost) before email links are built.");
        }

        if (!path.StartsWith('/') || path.StartsWith("//", StringComparison.Ordinal))
        {
            throw new ArgumentException($"Email links must be app paths starting with '/': {path}", nameof(path));
        }

        return origin.TrimEnd('/') + path;
    }

    private static string Encode(string value) => WebUtility.HtmlEncode(value);

    private static string Style(string rule)
    {
        foreach (var (name, value) in Tokens)
        {
            rule = rule.Replace("{" + name + "}", value, StringComparison.Ordinal);
        }

        return rule.Replace("\"", "&quot;", StringComparison.Ordinal);
    }
}
