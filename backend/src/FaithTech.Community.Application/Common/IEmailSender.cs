namespace FaithTech.Community.Application.Common;

/// <summary>A text attachment, such as an event's .ics calendar file.</summary>
public record EmailAttachment(string FileName, string ContentType, string Content);

/// <summary>The email's button: its label and the app path it opens, which the renderer joins to <c>WebApp:Origin</c>.</summary>
public record EmailAction(string Label, string Path);

/// <summary>
/// What an email says, independent of format (docs/mocks/notifications/email): a title, plain paragraphs and an
/// optional action, plus an optional text link after it (such as a guest's cancel link). Every string is text; the
/// renderer escapes it for the HTML part. An announcement names its unsubscribe path, which the footer links to
/// (L2-030 AC3).
/// </summary>
public record EmailContent(
    string Title,
    IReadOnlyList<string> Paragraphs,
    EmailAction? Action = null,
    string? UnsubscribePath = null,
    EmailAction? SecondaryAction = null);

/// <summary>
/// One email to queue. <see cref="Kind"/> says what it reports (a <c>NotificationKind</c> name or an
/// <see cref="EmailKinds"/> value) and <see cref="CorrelationId"/> the record it is about, for tracing a delivery.
/// </summary>
public record EmailMessage(
    string To,
    string Subject,
    EmailContent Content,
    string Kind,
    string? CorrelationId = null,
    IReadOnlyList<EmailAttachment>? Attachments = null);

/// <summary>Kinds of email that are not notifications.</summary>
public static class EmailKinds
{
    public const string EmailVerification = "EmailVerification";
    public const string PasswordReset = "PasswordReset";
}

/// <summary>
/// Queues email in the caller's unit of work (ADR 0015): nothing is written until the caller saves, so an action and
/// the email that reports it commit together (L2-028, L2-047). The delivery worker sends it later.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
