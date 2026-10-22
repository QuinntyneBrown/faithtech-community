using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using FaithTech.Community.Application.Common;
using MimeKit;

namespace FaithTech.Community.Infrastructure.Email;

/// <summary>Builds the message the provider receives: the plain-text body and an HTML alternative derived from it (L2-028 AC2).</summary>
public static partial class EmailMime
{
    public static MimeMessage Build(EmailMessage message, string from)
    {
        var mime = new MimeMessage
        {
            Subject = message.Subject,
            Body = Body(message),
        };
        mime.From.Add(MailboxAddress.Parse(from));
        mime.To.Add(MailboxAddress.Parse(message.To));
        return mime;
    }

    // The text and HTML alternatives, wrapped with any attachments (such as an RSVP's .ics) in multipart/mixed.
    private static MimeEntity Body(EmailMessage message)
    {
        var alternatives = new MultipartAlternative
        {
            new TextPart("plain") { Text = message.Body },
            new TextPart("html") { Text = Html(message.Body) },
        };
        if (message.Attachments is not { Count: > 0 } attachments)
        {
            return alternatives;
        }

        var mixed = new Multipart("mixed") { alternatives };
        foreach (var attachment in attachments)
        {
            mixed.Add(new MimePart(ContentType.Parse(attachment.ContentType))
            {
                Content = new MimeContent(new MemoryStream(Encoding.UTF8.GetBytes(attachment.Content))),
                ContentDisposition = new ContentDisposition(ContentDisposition.Attachment),
                ContentTransferEncoding = ContentEncoding.Base64,
                FileName = attachment.FileName,
            });
        }

        return mixed;
    }

    // Paragraphs from blank lines, everything escaped, and links made clickable.
    private static string Html(string text)
    {
        var paragraphs = text.Replace("\r\n", "\n")
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(p => Links().Replace(WebUtility.HtmlEncode(p.Trim()), m => $"<a href=\"{m.Value}\">{m.Value}</a>").Replace("\n", "<br>"))
            .Select(p => $"<p>{p}</p>");
        return $"<!doctype html><html><body>{string.Concat(paragraphs)}</body></html>";
    }

    [GeneratedRegex(@"https?://[^\s<>""]+")]
    private static partial Regex Links();
}
