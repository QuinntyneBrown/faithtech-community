using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Contacts;

/// <summary>Contacts created through the API, and the shapes the contacts endpoints answer with.</summary>
public static class ContactClients
{
    public sealed record ContactMatch(Guid ProfileId, string Name);

    public sealed record ContactSummary(
        Guid Id, string Name, string? Email, string? Organization, string? City, string Status, DateTime? ArchivedAtUtc);

    public sealed record Contact(
        Guid Id,
        string Name,
        string? Email,
        string? Phone,
        string? Organization,
        string? City,
        Guid? LinkedProfileId,
        string? PhotoUrl,
        string? PhotoAltText,
        ContactMatch? Match,
        DateTime? ArchivedAtUtc,
        int NoteCount,
        bool IsOwn,
        DateTime CreatedAtUtc);

    public sealed record Note(Guid Id, string Body, DateTime CreatedAtUtc);

    public static object NewContact(string name, string? email = null, string? notes = null, string? organization = null) =>
        new { Name = name, Email = email, Phone = (string?)null, Organization = organization, City = "Toronto", Notes = notes };

    public static async Task<Contact> CreateContactAsync(
        this CommunityApiFactory factory, ProfileClients.Member lead, string name, string? email = null, string? notes = null, string? organization = null)
    {
        var response = await factory.ClientFor(lead, Role.CityLead).PostAsJsonAsync("/api/contacts", NewContact(name, email, notes, organization));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Contact>())!;
    }

    public static async Task<ContactSummary[]> ListContactsAsync(this HttpClient client, string? term = null) =>
        (await client.GetFromJsonAsync<ContactSummary[]>(term is null ? "/api/contacts" : $"/api/contacts?q={Uri.EscapeDataString(term)}"))!;
}
