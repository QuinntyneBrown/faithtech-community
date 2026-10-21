using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Admin;

/// <summary>Tells a member their roles changed: an in-app notification now, and an email (L2-009 AC1).</summary>
public class RoleChangeNotifier(IApplicationDbContext db, IEmailSender email, IOptions<WebAppOptions> webApp, TimeProvider time)
{
    /// <summary>Adds the in-app notification to the unit of work; call <see cref="EmailAsync"/> once it is saved.</summary>
    public void Notify(Guid ownerProfileId, string title) =>
        db.Notifications.Add(new Notification(ownerProfileId, NotificationKind.RoleChanged, title, "/people/me", time.GetUtcNow()));

    public async Task EmailAsync(Guid ownerProfileId, string title, CancellationToken cancellationToken = default)
    {
        var address = await db.Users.Where(u => u.ProfileId == ownerProfileId).Select(u => u.Email).SingleOrDefaultAsync(cancellationToken);
        if (address is null)
        {
            return;
        }

        await email.SendAsync(new EmailMessage(
            address,
            "Your FaithTech Community roles changed",
            $"{title}.\n\nSee your profile: {webApp.Value.Origin}/people/me"),
            cancellationToken);
    }
}
