namespace FaithTech.Community.Application.Common;

/// <summary>A text attachment, such as an event's .ics calendar file.</summary>
public record EmailAttachment(string FileName, string ContentType, string Content);

/// <summary>An email with its plain-text <see cref="Body"/>; <see cref="HtmlBody"/> is rendered from it when queued.</summary>
public record EmailMessage(
    string To, string Subject, string Body, IReadOnlyList<EmailAttachment>? Attachments = null, string? HtmlBody = null);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

/// <summary>
/// Adds an email to the caller's unit of work, so it is queued in the same save as the action that raised it
/// (L2-028). The outbox worker delivers it later.
/// </summary>
public interface IEmailQueue
{
    void Enqueue(EmailMessage message);
}
