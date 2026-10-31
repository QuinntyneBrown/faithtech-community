using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Identity;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Contacts;

public record LinkContactCommand(Guid ProfileId, bool DiscardNotes = false);

/// <summary>
/// Tells each lead whose private contact just verified their email (L2-015 AC1, AC3): an in-app
/// notification now and an email. Called once an account's email becomes verified, after connecting the
/// leads whose connect link the person used.
/// </summary>
public class ContactSignedUpHandler(
    IApplicationDbContext db, ContactConnector connector, IEmailQueue emails, ICurrentOrganisation organisation, TimeProvider time)
{
    public async Task HandleAsync(EmailVerified verified, CancellationToken cancellationToken = default)
    {
        // A person who used a lead's connect link becomes that lead's contact first (L2-084, ADR 0022),
        // so the match below no longer sees the contact it just linked.
        await connector.ConnectPendingAsync(verified.ProfileId, cancellationToken);

        var normalized = verified.Email.Trim().ToUpperInvariant();
        var matches = await db.Contacts.AsNoTracking()
            .Where(c => c.LinkedProfileId == null && c.ArchivedAtUtc == null && c.Email != null && c.Email.ToUpper() == normalized)
            .Select(c => new { c.Id, c.Name, c.OwnerId })
            .ToListAsync(cancellationToken);
        if (matches.Count == 0)
        {
            return;
        }

        var now = time.GetUtcNow();
        foreach (var contact in matches)
        {
            db.Notifications.Add(new Notification(
                contact.OwnerId, NotificationKind.ContactSignedUp, Title(contact.Name), $"/contacts/{contact.Id}", now));
        }

        var owners = matches.Select(m => m.OwnerId).Distinct().ToList();
        var addresses = await db.Profiles.Where(p => owners.Contains(p.Id))
            .Join(db.Users, p => p.UserId, u => (Guid?)u.Id, (p, u) => new { p.Id, u.Email })
            .ToDictionaryAsync(x => x.Id, x => x.Email, cancellationToken);
        foreach (var contact in matches)
        {
            if (addresses.GetValueOrDefault(contact.OwnerId) is not { } address)
            {
                continue;
            }

            emails.Enqueue(new EmailMessage(
                address,
                Title(contact.Name),
                $"{contact.Name}, one of your private contacts, just joined {organisation.Name}.\n\n" +
                $"Link them to their new profile and keep your notes:\n\n{organisation.Origin}/contacts/{contact.Id}\n\n" +
                "Your notes stay private to you."));
        }

        // The notifications and emails commit together (L2-028).
        await db.SaveChangesAsync(cancellationToken);
    }

    private string Title(string name) => $"{name} just joined {organisation.ShortName}";
}

/// <summary>Links a private contact to the member's real profile (L2-015 AC2, AC5); notes stay private.</summary>
public class LinkContactHandler(IApplicationDbContext db, ContactAccess access, ContactViews views)
{
    public async Task<(Result Result, ContactDto? Contact)> LinkAsync(Guid id, LinkContactCommand command, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(id, withNotes: command.DiscardNotes, cancellationToken);
        if (contact is null || !await db.Profiles.AnyAsync(p => p.Id == command.ProfileId, cancellationToken))
        {
            return (Result.NotFound(), null);
        }

        if (contact.LinkedProfileId is not null)
        {
            return (Result.Conflict("The contact is already linked to a profile."), null);
        }

        contact.LinkTo(command.ProfileId, command.DiscardNotes);
        access.AuditOverride(kind, actor, contact, "contact.linked", after: new { contact.Name, command.ProfileId, command.DiscardNotes });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.ToDtoAsync(contact, kind == ContactAccessKind.Owner, cancellationToken));
    }
}
