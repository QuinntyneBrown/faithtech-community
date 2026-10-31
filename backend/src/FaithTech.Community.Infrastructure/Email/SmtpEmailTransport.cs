using System.Text;
using FaithTech.Community.Application.Common;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace FaithTech.Community.Infrastructure.Email;

/// <summary>Sends through SMTP, which also covers the SendGrid SMTP relay.</summary>
public class SmtpEmailTransport(IOptions<SmtpOptions> options) : IEmailTransport
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var smtp = options.Value;
        // Plain text always, with the HTML part as the alternative when there is one (L2-028 AC2).
        var body = new BodyBuilder { TextBody = message.Body, HtmlBody = message.HtmlBody };
        foreach (var attachment in message.Attachments ?? [])
        {
            body.Attachments.Add(attachment.FileName, Encoding.UTF8.GetBytes(attachment.Content), ContentType.Parse(attachment.ContentType));
        }

        var mime = new MimeMessage
        {
            Subject = message.Subject,
            Body = body.ToMessageBody(),
        };
        var from = MailboxAddress.Parse(smtp.From);
        if (message.FromName is { Length: > 0 } name)
        {
            from.Name = name;
        }

        mime.From.Add(from);
        mime.To.Add(MailboxAddress.Parse(message.To));

        using var client = new SmtpClient();
        var security = smtp.UseTls ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
        await client.ConnectAsync(smtp.Host, smtp.Port, security, cancellationToken);
        if (!string.IsNullOrEmpty(smtp.UserName))
        {
            await client.AuthenticateAsync(smtp.UserName, smtp.Password ?? string.Empty, cancellationToken);
        }

        await client.SendAsync(mime, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
