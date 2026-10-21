using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Contacts;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Contacts;

/// <summary>A new contact (L2-013). Notes is the optional first note.</summary>
public record CreateContactCommand(
    string? Name, string? Email, string? Phone, string? Organization, string? City, string? Notes = null, bool LinkToMember = false);

public record UpdateContactCommand(string? Name, string? Email, string? Phone, string? Organization, string? City);

public static class ContactRules
{
    public const int MaxName = 200;
    public const int MaxEmail = 256;
    public const int MaxField = 200;
    public const int MaxNote = 2000;
    public const string NameMessage = "Enter at least a first name.";
    public const string EmailMessage = "Enter an email like name@example.org, or leave it empty.";

    public static void Details<T>(AbstractValidator<T> v, Func<T, string?> name, Func<T, string?> email, Func<T, string?> phone,
        Func<T, string?> organization, Func<T, string?> city)
    {
        v.RuleFor(x => name(x)).Cascade(CascadeMode.Stop)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage(NameMessage)
            .Must(n => n!.Trim().Length <= MaxName).WithMessage($"Use {MaxName} characters or fewer for the name.")
            .OverridePropertyName("Name");
        v.RuleFor(x => email(x)).Cascade(CascadeMode.Stop)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(email(x))).WithMessage(EmailMessage)
            .Must(e => (e?.Trim().Length ?? 0) <= MaxEmail).WithMessage(EmailMessage)
            .OverridePropertyName("Email");
        v.RuleFor(x => phone(x)).Must(Short).WithMessage($"Use {MaxField} characters or fewer for the phone.").OverridePropertyName("Phone");
        v.RuleFor(x => organization(x)).Must(Short).WithMessage($"Use {MaxField} characters or fewer for the organisation.").OverridePropertyName("Organization");
        v.RuleFor(x => city(x)).Must(Short).WithMessage($"Use {MaxField} characters or fewer for the city.").OverridePropertyName("City");
    }

    public static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool Short(string? value) => (value?.Trim().Length ?? 0) <= MaxField;
}

public class CreateContactValidator : AbstractValidator<CreateContactCommand>
{
    public CreateContactValidator()
    {
        ContactRules.Details(this, x => x.Name, x => x.Email, x => x.Phone, x => x.Organization, x => x.City);
        RuleFor(x => x.Notes)
            .Must(n => (n?.Trim().Length ?? 0) <= ContactRules.MaxNote).WithMessage($"Use {ContactRules.MaxNote} characters or fewer for the note.");
    }
}

public class UpdateContactValidator : AbstractValidator<UpdateContactCommand>
{
    public UpdateContactValidator() =>
        ContactRules.Details(this, x => x.Name, x => x.Email, x => x.Phone, x => x.Organization, x => x.City);
}

/// <summary>Creates, reads and edits private contacts (L2-012, L2-013).</summary>
public class ManageContactsHandler(IApplicationDbContext db, ContactAccess access, ContactViews views, TimeProvider time)
{
    public async Task<(Result Result, ContactDto? Contact)> CreateAsync(CreateContactCommand command, CancellationToken cancellationToken = default)
    {
        if (!access.CanKeepContacts || await access.CallerProfileIdAsync(cancellationToken) is not { } owner)
        {
            return (Result.Forbidden(), null);
        }

        // "Save and link" (L2-013 AC6): a verified member already uses this email.
        var member = await views.MatchAsync(command.Email, cancellationToken);
        if (member is not null && !command.LinkToMember)
        {
            return (Result.Conflict($"{member.Name} is already a member.", new Dictionary<string, object?> { ["memberName"] = member.Name }), null);
        }

        var contact = new Contact(
            owner,
            command.Name!.Trim(),
            ContactRules.Blank(command.Email),
            ContactRules.Blank(command.Phone),
            ContactRules.Blank(command.Organization),
            ContactRules.Blank(command.City));
        if (member is not null)
        {
            contact.LinkTo(member.ProfileId);
        }

        if (ContactRules.Blank(command.Notes) is { } note)
        {
            contact.AddNote(note, time.GetUtcNow().UtcDateTime);
        }

        db.Contacts.Add(contact);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.ToDtoAsync(contact, isOwn: true, cancellationToken));
    }

    public async Task<ContactDto?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(id, cancellationToken: cancellationToken);
        if (contact is null)
        {
            return null;
        }

        access.AuditOverride(kind, actor, contact, "contact.viewed");
        await db.SaveChangesAsync(cancellationToken);
        return await views.ToDtoAsync(contact, kind == ContactAccessKind.Owner, cancellationToken);
    }

    public async Task<(Result Result, ContactDto? Contact)> UpdateAsync(Guid id, UpdateContactCommand command, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(id, cancellationToken: cancellationToken);
        if (contact is null)
        {
            return (Result.NotFound(), null);
        }

        var before = Snapshot(contact);
        contact.Update(
            command.Name!.Trim(),
            ContactRules.Blank(command.Email),
            ContactRules.Blank(command.Phone),
            ContactRules.Blank(command.Organization),
            ContactRules.Blank(command.City));
        access.AuditOverride(kind, actor, contact, "contact.updated", before, Snapshot(contact));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.ToDtoAsync(contact, kind == ContactAccessKind.Owner, cancellationToken));
    }

    /// <summary>
    /// The caller's own active contacts by name, filtered in the database on name, email, organisation or
    /// note text (L2-012 AC3, L2-013 AC3, L2-042 AC3). Null when the caller may not keep contacts.
    /// </summary>
    public Task<IReadOnlyList<ContactSummaryDto>?> ListAsync(string? term, CancellationToken cancellationToken = default) =>
        SummariesAsync(archived: false, term, cancellationToken);

    /// <summary>The caller's own archived contacts, most recently archived first (L2-016).</summary>
    public Task<IReadOnlyList<ContactSummaryDto>?> ListArchivedAsync(CancellationToken cancellationToken = default) =>
        SummariesAsync(archived: true, term: null, cancellationToken);

    private async Task<IReadOnlyList<ContactSummaryDto>?> SummariesAsync(bool archived, string? term, CancellationToken cancellationToken)
    {
        if (!access.CanKeepContacts || await access.CallerProfileIdAsync(cancellationToken) is not { } owner)
        {
            return null;
        }

        var contacts = db.Contacts.AsNoTracking().Where(c => c.OwnerId == owner && (c.ArchivedAtUtc != null) == archived);
        if (ContactRules.Blank(term) is { } search)
        {
            var like = search.ToLower();
            contacts = contacts.Where(c =>
                c.Name.ToLower().Contains(like)
                || (c.Email != null && c.Email.ToLower().Contains(like))
                || (c.Organization != null && c.Organization.ToLower().Contains(like))
                || db.ContactNotes.Any(n => n.ContactId == c.Id && n.Body.ToLower().Contains(like)));
        }

        var rows = await contacts
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Email,
                c.Organization,
                c.City,
                c.LinkedProfileId,
                c.ArchivedAtUtc,
                Linked = db.Profiles.Where(p => p.Id == c.LinkedProfileId).Select(p => p.Name).FirstOrDefault(),
                SignedUp = c.LinkedProfileId == null && c.Email != null
                    && db.Users.Any(u => u.EmailConfirmed && u.NormalizedEmail == c.Email.ToUpper()),
            })
            .ToListAsync(cancellationToken);
        var summaries = rows.Select(r => new ContactSummaryDto(
            r.Id,
            r.Linked ?? r.Name,
            r.Email,
            r.Organization,
            r.City,
            r.LinkedProfileId is not null ? "Member" : r.SignedUp ? "SignedUp" : "Private",
            r.ArchivedAtUtc));
        return archived
            ? [.. summaries.OrderByDescending(r => r.ArchivedAtUtc)]
            : [.. summaries.OrderBy(r => r.Name, StringComparer.CurrentCultureIgnoreCase)];
    }

    private static object Snapshot(Contact c) => new { c.Name, c.Email, c.Phone, c.Organization, c.City };
}
