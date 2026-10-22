using System.Text.Json;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FaithTech.Community.Infrastructure.Email;

/// <summary>Delivers a message to the provider. Only the outbox dispatcher calls it.</summary>
public interface IEmailTransport
{
    Task SendAsync(OutgoingEmail message, CancellationToken cancellationToken = default);
}

public class OutboxMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string To { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;

    /// <summary>The plain-text part.</summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>The HTML alternative, rendered from the same template as <see cref="Body"/>.</summary>
    public string? HtmlBody { get; set; }

    /// <summary>What the email reports, such as a <c>NotificationKind</c> name or <c>EmailVerification</c>.</summary>
    public string? Kind { get; set; }

    /// <summary>The record the email is about (a notification, invite or event id), for tracing a delivery.</summary>
    public string? CorrelationId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset NextAttemptAt { get; set; }

    public int Attempts { get; set; }

    public DateTimeOffset? SentAt { get; set; }

    /// <summary>Set when the last allowed attempt fails; the dispatcher never selects the row again.</summary>
    public DateTimeOffset? FailedAt { get; set; }

    public string? LastError { get; set; }

    /// <summary>The message's attachments as JSON, such as an RSVP's .ics; null when there are none.</summary>
    public string? AttachmentsJson { get; set; }
}

/// <summary>
/// Queues email in the caller's unit of work: the outbox row is added, not saved, so the caller's SaveChanges commits
/// it together with the action it reports (L2-028, issue #174). The action then commits even when the provider is
/// down, and no action commits without its email.
/// </summary>
public class OutboxEmailSender(CommunityDbContext db, EmailTemplateRenderer renderer, TimeProvider time) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var (text, html) = renderer.Render(message);
        db.OutboxMessages.Add(new OutboxMessage
        {
            To = message.To,
            Subject = message.Subject,
            Body = text,
            HtmlBody = html,
            Kind = message.Kind,
            CorrelationId = message.CorrelationId,
            AttachmentsJson = message.Attachments is { Count: > 0 } attachments ? JsonSerializer.Serialize(attachments) : null,
            CreatedAt = now,
            NextAttemptAt = now,
        });
        return Task.CompletedTask;
    }
}

public class EmailOutboxDispatcher(
    CommunityDbContext db, IEmailTransport transport, TimeProvider time, ILogger<EmailOutboxDispatcher> logger)
{
    private const int BatchSize = 20;

    /// <summary>Delivery attempts in all, including the first send (L2-028).</summary>
    public const int MaxAttempts = 5;
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromHours(1);

    public async Task DispatchPendingAsync(CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var due = await db.OutboxMessages
            .Where(m => m.SentAt == null && m.FailedAt == null && m.NextAttemptAt <= now)
            .OrderBy(m => m.NextAttemptAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var message in due)
        {
            try
            {
                var attachments = message.AttachmentsJson is { } json ? JsonSerializer.Deserialize<List<EmailAttachment>>(json) : null;
                await transport.SendAsync(
                    new OutgoingEmail(message.To, message.Subject, message.Body, message.HtmlBody ?? $"<pre>{System.Net.WebUtility.HtmlEncode(message.Body)}</pre>", attachments), cancellationToken);
                message.SentAt = time.GetUtcNow();
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                message.Attempts++;
                // Provider errors can quote the recipient address, which is personal data.
                var error = exception.Message.Replace(message.To, "[recipient]", StringComparison.OrdinalIgnoreCase);
                message.LastError = error.Length > 500 ? error[..500] : error;
                if (message.Attempts >= MaxAttempts)
                {
                    message.FailedAt = time.GetUtcNow();
                    // Log the message id only, never the exception text or the recipient.
                    logger.LogError("Email {OutboxMessageId} failed {Attempts} times and will not be retried", message.Id, message.Attempts);
                }
                else
                {
                    var backoff = TimeSpan.FromMinutes(Math.Pow(2, message.Attempts));
                    message.NextAttemptAt = time.GetUtcNow() + (backoff < MaxBackoff ? backoff : MaxBackoff);
                    logger.LogWarning("Email {OutboxMessageId} failed on attempt {Attempts} of {MaxAttempts}: {ErrorType}",
                        message.Id, message.Attempts, MaxAttempts, exception.GetType().Name);
                }
            }

            await db.SaveChangesAsync(cancellationToken);
        }
    }
}

public class EmailOutboxWorker(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<EmailOutboxWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Outbox:Enabled", true))
        {
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(configuration.GetValue("Outbox:IntervalSeconds", 10)));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<EmailOutboxDispatcher>().DispatchPendingAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Email outbox dispatch failed");
            }
        }
    }
}
