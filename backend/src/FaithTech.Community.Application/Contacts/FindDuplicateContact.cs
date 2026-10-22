using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Contacts;

/// <summary>An email typed on the contact form, and the contact being edited, which never matches itself (L2-091 AC1).</summary>
public record FindDuplicateContactQuery(string? Email, Guid? ExcludeId);

/// <summary>
/// Finds the caller's own contact, active or archived, with the same email, trimmed and compared case-insensitively
/// (L2-091). Only the caller's own contacts are read, System Admin included, so another lead's contact is never
/// revealed (L2-091 AC5, AC6, L2-012).
/// </summary>
public class FindDuplicateContactHandler(IApplicationDbContext db, ContactAccess access)
{
    public async Task<(Result Result, DuplicateContactDto? Match)> FindAsync(FindDuplicateContactQuery query, CancellationToken cancellationToken = default)
    {
        if (!access.CanKeepContacts || await access.CallerProfileIdAsync(cancellationToken) is not { } owner)
        {
            return (Result.Forbidden(), null);
        }

        if (ContactRules.Blank(query.Email) is not { } email)
        {
            return (Result.Ok(), null);
        }

        // Contact emails are stored trimmed (ContactRules.Blank), so only the query value is trimmed.
        var lower = email.ToLower();
        var match = await db.Contacts.AsNoTracking()
            .Where(c => c.OwnerId == owner && c.Email != null && c.Email.ToLower() == lower)
            .Where(c => query.ExcludeId == null || c.Id != query.ExcludeId)
            .OrderBy(c => c.CreatedAtUtc)
            .Select(c => new DuplicateContactDto(
                c.Id,
                db.Profiles.Where(p => p.Id == c.LinkedProfileId).Select(p => p.Name).FirstOrDefault() ?? c.Name,
                c.Organization,
                c.Email!,
                c.CreatedAtUtc,
                db.ContactNotes.Count(n => n.ContactId == c.Id),
                c.ArchivedAtUtc != null))
            .FirstOrDefaultAsync(cancellationToken);
        return (Result.Ok(), match);
    }
}
