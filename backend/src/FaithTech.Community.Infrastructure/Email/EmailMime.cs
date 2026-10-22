using System.Text;
using MimeKit;

namespace FaithTech.Community.Infrastructure.Email;

/// <summary>
/// Builds the message the provider receives: the plain-text part and its HTML alternative as
/// <c>multipart/alternative</c> (L2-028 AC2), wrapped with any attachments, such as an RSVP's .ics, in
/// <c>multipart/mixed</c> (L2-022 AC1).
/// </summary>
public static class EmailMime
{
    public static MimeMessage Build(OutgoingEmail message, string from)
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

    private static MimeEntity Body(OutgoingEmail message)
    {
        var alternatives = new MultipartAlternative
        {
            new TextPart("plain") { Text = message.Text },
            new TextPart("html") { Text = message.Html },
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
}
