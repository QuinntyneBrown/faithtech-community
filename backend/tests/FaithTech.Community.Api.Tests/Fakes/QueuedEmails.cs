using System.Text.Json;
using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Fakes;

/// <summary>An email as the outbox committed it: what the delivery worker will hand to the provider.</summary>
public record QueuedEmail(
    string To,
    string Subject,
    string Body,
    string? HtmlBody,
    string? Kind,
    string? CorrelationId,
    IReadOnlyList<EmailAttachment>? Attachments);

/// <summary>
/// Reads the emails the API committed to its outbox. Handlers queue email in their own unit of work (L2-028,
/// ADR 0015), so only an email saved with the action it reports appears here.
/// </summary>
public class QueuedEmails(CommunityApiFactory factory)
{
    public IEnumerable<QueuedEmail> SentTo(string address)
    {
        var rows = factory.WithDbAsync(db => db.OutboxMessages.AsNoTracking()
            .Where(m => m.To.ToLower() == address.ToLower())
            .ToListAsync()).GetAwaiter().GetResult();
        return rows.OrderBy(m => m.CreatedAt).Select(m => new QueuedEmail(
            m.To,
            m.Subject,
            m.Body,
            m.HtmlBody,
            m.Kind,
            m.CorrelationId,
            m.AttachmentsJson is { } json ? JsonSerializer.Deserialize<List<EmailAttachment>>(json) : null)).ToList();
    }
}
