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

    public string? LastError { get; set; }
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
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromHours(1);

    public async Task DispatchPendingAsync(CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var due = await db.OutboxMessages
            .Where(m => m.SentAt == null && m.NextAttemptAt <= now)
            .OrderBy(m => m.NextAttemptAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var message in due)
        {
            try
            {
                await transport.SendAsync(new EmailMessage(message.To, message.Subject, message.Body), cancellationToken);
                message.SentAt = time.GetUtcNow();
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                message.Attempts++;
                var backoff = TimeSpan.FromMinutes(Math.Pow(2, message.Attempts));
                message.NextAttemptAt = time.GetUtcNow() + (backoff < MaxBackoff ? backoff : MaxBackoff);
                message.LastError = exception.Message.Length > 500 ? exception.Message[..500] : exception.Message;
                // Log the message id only: the recipient address is personal data.
                logger.LogWarning(exception, "Email {OutboxMessageId} failed on attempt {Attempts}", message.Id, message.Attempts);
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
