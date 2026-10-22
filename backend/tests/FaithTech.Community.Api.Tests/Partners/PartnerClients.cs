using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Partners;

/// <summary>Partners created through the API, and the shapes the partners endpoints answer with.</summary>
public static class PartnerClients
{
    public sealed record StageChange(string From, string To, Guid MovedById, string MovedByName, DateTime MovedAtUtc, string? Note);

    public sealed record Partner(
        Guid Id,
        string Name,
        string? Website,
        string? Offering,
        Guid? OwnerId,
        string? OwnerName,
        string? ContactName,
        string? Email,
        string? Phone,
        string? Notes,
        string Stage,
        StageChange[] History,
        bool CanEdit);

    public sealed record Card(Guid Id, string Name, string? ContactName, string? Offering);

    public sealed record Column(string Stage, int Count, Card[] Cards);

    public sealed record Board(Column[] Columns, bool CanEdit);

    public sealed record Owner(Guid ProfileId, string Name);

    public static object NewPartner(string name, string? stage = null, Guid? ownerId = null, string? email = null) => new
    {
        Name = name,
        Website = "kestrel.example",
        Offering = "Venue for Builders Night",
        OwnerId = ownerId,
        ContactName = "Nadia Petrov",
        Email = email,
        Phone = "416-555-0199",
        Notes = "Studio of 12 developers.",
        Stage = stage,
    };

    public static async Task<Partner> CreatePartnerAsync(
        this CommunityApiFactory factory, ProfileClients.Member lead, string name, string? stage = null)
    {
        var response = await factory.ClientFor(lead, Role.CityLead).PostAsJsonAsync("/api/partners", NewPartner(name, stage));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Partner>())!;
    }
}
