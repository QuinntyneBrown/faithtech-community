using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Partners;

/// <summary>Partners created through the API, and the shapes the partners endpoints answer with.</summary>
public static class PartnerClients
{
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
        bool CanEdit,
        DateOnly? LastActivityOn,
        string? NextStep,
        DateOnly? NextStepDue,
        bool CanLogActivity);

    public sealed record Card(Guid Id, string Name, string? ContactName, string? Offering, string? NextStep, DateOnly? NextStepDue);

    public sealed record Column(string Stage, int Count, Card[] Cards);

    public sealed record Board(Column[] Columns, bool CanEdit);

    public sealed record Owner(Guid ProfileId, string Name);

    public sealed record Activity(
        Guid Id,
        string Kind,
        string? Summary,
        string Text,
        DateOnly OccurredOn,
        TimeOnly? OccurredAt,
        string? NextStep,
        DateOnly? NextStepDue,
        Guid LoggedById,
        string LoggedByName,
        DateTime LoggedAtUtc,
        string? FromStage,
        string? ToStage);

    public sealed record ActivityPage(Activity[] Items, string? Before);

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

    /// <summary>A partner with only the details a duplicate check reads, added by the lead.</summary>
    public static async Task<Partner> AddPartnerAsync(
        this CommunityApiFactory factory, ProfileClients.Member lead, string name, string? website, string? email = null)
    {
        var response = await factory.ClientFor(lead, Role.CityLead).PostAsJsonAsync("/api/partners", new
        {
            Name = name,
            Website = website,
            Email = email,
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Partner>())!;
    }

    public sealed record Duplicate(Guid Id, string Name, string Reason, string MatchedOn, string? AddedByName, DateOnly? AddedOn);

    public sealed record Duplicates(Duplicate[] Matches);

    public static async Task<Duplicates> DuplicatesAsync(this HttpClient client, Guid partnerId) =>
        (await client.GetFromJsonAsync<Duplicates>($"/api/partners/{partnerId}/duplicates"))!;

    public static Task<HttpResponseMessage> DismissDuplicateAsync(this HttpClient client, Guid partnerId, Guid otherId) =>
        client.PostAsync($"/api/partners/{partnerId}/duplicates/{otherId}/dismissal", null);

    public static object NewActivity(
        string kind = "Call",
        string? summary = "Called Nadia about the contract.",
        string? occurredOn = null,
        string? occurredAt = null,
        string? nextStep = null,
        string? nextStepDue = null) => new
    {
        Kind = kind,
        Summary = summary,
        OccurredOn = occurredOn,
        OccurredAt = occurredAt,
        NextStep = nextStep,
        NextStepDue = nextStepDue,
    };

    public static Task<HttpResponseMessage> LogActivityAsync(this HttpClient client, Guid partnerId, object activity) =>
        client.PostAsJsonAsync($"/api/partners/{partnerId}/activities", activity);

    public static async Task<ActivityPage> ActivitiesAsync(this HttpClient client, Guid partnerId, string query = "") =>
        (await client.GetFromJsonAsync<ActivityPage>($"/api/partners/{partnerId}/activities{query}"))!;
}
