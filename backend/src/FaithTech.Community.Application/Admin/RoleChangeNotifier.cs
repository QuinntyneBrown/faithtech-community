using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Admin;

/// <summary>
/// Tells a member their roles changed: an in-app notification and an email (L2-009 AC1). Both join the caller's unit
/// of work, so they are saved with the role change itself (L2-028).
/// </summary>
public class RoleChangeNotifier(IApplicationDbContext db, IEmailQueue emails, IOptions<WebAppOptions> webApp, TimeProvider time)
{
    /// <summary>Adds the in-app notification to the unit of work.</summary>
    public void Notify(Guid ownerProfileId, string title) =>
        db.Notifications.Add(new Notification(ownerProfileId, NotificationKind.RoleChanged, title, "/people/me", time.GetUtcNow()));

    /// <summary>Queues the email in the unit of work; the caller saves.</summary>
    public async Task QueueEmailAsync(Guid ownerProfileId, string title, CancellationToken cancellationToken = default)
    {
        var address = await db.Users.Where(u => u.ProfileId == ownerProfileId).Select(u => u.Email).SingleOrDefaultAsync(cancellationToken);
        if (address is null)
        {
            return;
        }

        emails.Enqueue(new EmailMessage(
            address,
            "Your FaithTech Community roles changed",
            $"{title}.\n\nSee your profile: {webApp.Value.Origin}/people/me"));
    }
}
