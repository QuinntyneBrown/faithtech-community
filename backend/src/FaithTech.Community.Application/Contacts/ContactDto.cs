using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Contacts;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Contacts;

/// <summary>A verified member who uses the contact's email (L2-015): offered for linking until the contact is linked.</summary>
public record ContactMatchDto(Guid ProfileId, string Name);

/// <summary>
/// A row of the contacts list, shown as a person card (L2-060). Status is Private, SignedUp (a verified member uses the
/// email) or Member (linked). The photo is the linked member's featured photo, or else the contact's own stored one.
/// </summary>
public record ContactSummaryDto(
    Guid Id,
    string Name,
    string? Email,
    string? Organization,
    string? City,
    string Status,
    DateTime? ArchivedAtUtc,
    string? PhotoUrl,
    string? PhotoAltText,
    int NoteCount,
    DateTime CreatedAtUtc);

/// <summary>
/// One contact. Once linked, the name and featured photo come from the member's profile (L2-015 AC2); otherwise
/// the featured photo is the contact's own. <c>Photos</c> are the contact's own photos, newest first (L2-056).
/// </summary>
public record ContactDto(
    Guid Id,
    string Name,
    string? Email,
    string? Phone,
    string? Organization,
    string? City,
    Guid? LinkedProfileId,
    string? PhotoUrl,
    string? PhotoAltText,
    ContactMatchDto? Match,
    DateTime? ArchivedAtUtc,
    int NoteCount,
    bool IsOwn,
    DateTime CreatedAtUtc,
    IReadOnlyList<ContactPhotoDto> Photos);

/// <summary>Builds contact DTOs: the linked profile's name and photo, and any verified member with the same email.</summary>
public class ContactViews(IApplicationDbContext db, IPhotoStorage storage)
{
    public async Task<ContactDto> ToDtoAsync(Contact contact, bool isOwn, CancellationToken cancellationToken = default)
    {
        var linked = contact.LinkedProfileId is { } profileId
            ? await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken)
            : null;
        var photo = linked?.Photos.FirstOrDefault(p => p.IsFeatured);
        var own = contact.Photos.FirstOrDefault(p => p.IsFeatured);
        var match = contact.LinkedProfileId is null ? await MatchAsync(contact.Email, cancellationToken) : null;
        var noteCount = await db.ContactNotes.CountAsync(n => n.ContactId == contact.Id, cancellationToken);
        return new ContactDto(
            contact.Id,
            linked?.Name ?? contact.Name,
            contact.Email,
            contact.Phone,
            contact.Organization,
            contact.City,
            contact.LinkedProfileId,
            linked is not null
                ? photo is null ? null : storage.GetReadUrl(photo.BlobName)
                : own is null ? null : ContactPhotoDto.ImageUrl(contact.Id, own),
            linked is not null ? photo?.AltText : own?.AltText,
            match,
            contact.ArchivedAtUtc,
            noteCount,
            isOwn,
            contact.CreatedAtUtc,
            [.. contact.Photos.OrderByDescending(p => p.UploadedAt).Select(p => ContactPhotoDto.From(contact.Id, p))]);
    }

    /// <summary>The verified member whose account uses this email, compared case-insensitively.</summary>
    public async Task<ContactMatchDto?> MatchAsync(string? email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var normalized = email.Trim().ToUpperInvariant();
        return await db.Users.Where(u => u.EmailConfirmed && u.NormalizedEmail == normalized)
            .Join(db.Profiles, u => u.ProfileId, p => p.Id, (u, p) => new ContactMatchDto(p.Id, p.Name))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
