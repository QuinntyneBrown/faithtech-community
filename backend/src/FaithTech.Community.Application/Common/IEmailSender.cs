namespace FaithTech.Community.Application.Common;

/// <summary>A text attachment, such as an event's .ics calendar file.</summary>
public record EmailAttachment(string FileName, string ContentType, string Content);

public record EmailMessage(string To, string Subject, string Body, IReadOnlyList<EmailAttachment>? Attachments = null);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
