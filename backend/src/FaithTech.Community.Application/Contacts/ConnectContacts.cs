using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Contacts;

/// <summary>What happened when someone used a lead's connect link (L2-082 AC4, AC5; L2-084 AC6).</summary>
public enum ConnectOutcome
{
    Connected,
    Pending,
    OwnCode,
}

/// <summary>
/// Makes a person who used a lead's connect link that lead's contact, without the lead confirming
/// (L2-084, ADR 0022): at once when their email is verified, otherwise when it becomes verified.
/// </summary>
public class ContactConnector(IApplicationDbContext db, IEmailQueue emails, ICurrentOrganisation organisation, TimeProvider time)
{
    public async Task<ConnectOutcome> RequestAsync(Guid leadId, Guid profileId, CancellationToken cancellationToken = default)
    {
        if (leadId == profileId)
        {
            return ConnectOutcome.OwnCode;
        }

        if (await db.Users.AnyAsync(u => u.ProfileId == profileId && u.EmailConfirmed, cancellationToken))
        {
            await ConnectAsync(leadId, profileId, cancellationToken);
            return ConnectOutcome.Connected;
        }

        if (!await db.PendingConnections.AnyAsync(p => p.ProfileId == profileId && p.LeadId == leadId, cancellationToken))
        {
            db.PendingConnections.Add(new PendingConnection(profileId, leadId, time.GetUtcNow()));
            await db.SaveChangesAsync(cancellationToken);
        }

        return ConnectOutcome.Pending;
    }

    /// <summary>Connects every pending connection of a profile whose email was just verified.</summary>
    public async Task ConnectPendingAsync(Guid profileId, CancellationToken cancellationToken = default)
    {
        var pending = await db.PendingConnections.Where(p => p.ProfileId == profileId).ToListAsync(cancellationToken);
        foreach (var connection in pending)
        {
            db.PendingConnections.Remove(connection);
            await ConnectAsync(connection.LeadId, profileId, cancellationToken);
        }
    }

    /// <summary>
    /// Links the lead's contact for the person, creating it if needed; true when a new link was made.
    /// Saves the contact, the notification and the email together (L2-028).
    /// </summary>
    public async Task<bool> ConnectAsync(Guid leadId, Guid profileId, CancellationToken cancellationToken = default)
    {
        if (await db.Contacts.AnyAsync(c => c.OwnerId == leadId && c.LinkedProfileId == profileId, cancellationToken))
        {
            // Already the lead's contact (L2-084 AC3); only a removed pending row may need saving.
            await db.SaveChangesAsync(cancellationToken);
            return false;
        }

        var person = await db.Users.Where(u => u.ProfileId == profileId)
            .Join(db.Profiles, u => u.ProfileId, p => p.Id, (u, p) => new { p.Name, u.Email })
            .SingleAsync(cancellationToken);
        var email = person.Email!;
        var normalized = email.Trim().ToUpperInvariant();
        var now = time.GetUtcNow();

        // One contact per email: the lead's earlier unlinked contact is linked, restored if archived (AC2).
        var contact = await db.Contacts
            .Where(c => c.OwnerId == leadId && c.LinkedProfileId == null && c.Email != null && c.Email.ToUpper() == normalized)
            .OrderBy(c => c.ArchivedAtUtc != null)
            .FirstOrDefaultAsync(cancellationToken);
        if (contact is null)
        {
            contact = new Contact(leadId, person.Name, email, null, null, null, now.UtcDateTime);
            db.Contacts.Add(contact);
        }
        else if (contact.IsArchived)
        {
            contact.Restore();
        }

        contact.LinkTo(profileId);
        var title = $"{person.Name} connected with you";
        db.Notifications.Add(new Notification(leadId, NotificationKind.ContactSignedUp, title, $"/contacts/{contact.Id}", now));
        if (await db.Users.Where(u => u.ProfileId == leadId).Select(u => u.Email).SingleOrDefaultAsync(cancellationToken) is { } address)
        {
            emails.Enqueue(new EmailMessage(
                address,
                title,
                $"{person.Name} used your QR code and joined {organisation.Name}. They’re now in your private contacts, " +
                $"linked to their profile, so you can add notes and follow up:\n\n{organisation.Origin}/contacts/{contact.Id}\n\n" +
                "Your notes stay private to you."));
        }

        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
