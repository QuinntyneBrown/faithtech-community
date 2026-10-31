using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

/// <summary>
/// In-app notifications and emails for workspace additions, assignments and Planning Poker invites (L2-027, L2-028).
/// <see cref="Notify"/> adds the notification to the unit of work; call <see cref="QueueEmailsAsync"/> before saving, so
/// the emails commit with the change they report (L2-028). Nobody is notified about their own action (ADR 0011).
/// </summary>
public class AgileNotifier(IApplicationDbContext db, IEmailQueue emails, ICurrentOrganisation organisation, TimeProvider time)
{
    private readonly List<(Guid Recipient, string Subject, string Body)> _emails = [];

    public void Notify(Guid actor, Guid recipient, NotificationKind kind, string title, string linkPath, string subject, string body)
    {
        if (recipient == actor)
        {
            return;
        }

        db.Notifications.Add(new Notification(recipient, kind, title, linkPath, time.GetUtcNow()));
        _emails.Add((recipient, subject, $"{body}\n\n{organisation.Origin}{linkPath}"));
    }

    /// <summary>Queues the collected emails in the unit of work; the caller saves.</summary>
    public async Task QueueEmailsAsync(CancellationToken cancellationToken = default)
    {
        var recipients = _emails.Select(e => e.Recipient).Distinct().ToList();
        var addresses = await db.Users.Where(u => recipients.Contains(u.ProfileId))
            .ToDictionaryAsync(u => u.ProfileId, u => u.Email, cancellationToken);
        foreach (var (recipient, subject, body) in _emails)
        {
            if (addresses.GetValueOrDefault(recipient) is { } address)
            {
                emails.Enqueue(new EmailMessage(address, subject, body));
            }
        }

        _emails.Clear();
    }

    public static string FirstName(string name) => name.Split(' ', 2)[0];
}
