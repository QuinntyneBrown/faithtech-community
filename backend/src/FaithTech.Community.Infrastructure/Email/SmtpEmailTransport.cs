using FaithTech.Community.Application.Common;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Infrastructure.Email;

/// <summary>Sends through SMTP, which also covers the SendGrid SMTP relay.</summary>
public class SmtpEmailTransport(IOptions<SmtpOptions> options) : IEmailTransport
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var smtp = options.Value;
        var mime = EmailMime.Build(message, smtp.From);

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
