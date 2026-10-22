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
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

public class OutboxMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string To { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

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

/// <summary>Queues email so the action that triggered it commits even when the provider is down.</summary>
public class OutboxEmailSender(CommunityDbContext db, TimeProvider time) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        db.OutboxMessages.Add(new OutboxMessage
        {
            To = message.To,
            Subject = message.Subject,
            Body = message.Body,
            AttachmentsJson = message.Attachments is { Count: > 0 } attachments ? JsonSerializer.Serialize(attachments) : null,
            CreatedAt = now,
            NextAttemptAt = now,
        });
        await db.SaveChangesAsync(cancellationToken);
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
                await transport.SendAsync(new EmailMessage(message.To, message.Subject, message.Body, attachments), cancellationToken);
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
