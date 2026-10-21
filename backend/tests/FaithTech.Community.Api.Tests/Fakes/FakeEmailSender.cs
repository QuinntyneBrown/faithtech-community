using System.Collections.Concurrent;
using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Api.Tests.Fakes;

public class FakeEmailSender : IEmailSender
{
    public ConcurrentQueue<EmailMessage> Sent { get; } = new();

    public IEnumerable<EmailMessage> SentTo(string address) =>
        Sent.Where(m => string.Equals(m.To, address, StringComparison.OrdinalIgnoreCase));

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        Sent.Enqueue(message);
        return Task.CompletedTask;
    }
}
