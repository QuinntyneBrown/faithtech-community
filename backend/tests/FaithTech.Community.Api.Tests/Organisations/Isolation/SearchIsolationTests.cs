using System.Net.Http.Json;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations.Isolation;

// Traces to: L2-130 AC2. Global search reads through the organisation's filtered context, so another organisation's
// profiles, contacts, partners, events, resources and notes never appear, even to a System Admin.
public class SearchIsolationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private sealed record Group(string Kind, object[] Items);

    private sealed record Results(Group[] Groups);

    [Fact]
    public async Task Another_organisations_records_never_appear_in_search()
    {
        var word = "Harbour" + Guid.NewGuid().ToString("N")[..8];
        var northside = await factory.AddOrganisationAsync();
        await factory.AddMemberAsync(northside, $"Ana {word}");
        var lead = factory.ClientOn(northside, await factory.AddMemberAsync(northside, "Bea Lima", Role.CityLead, Role.EventLead));
        var start = DateTimeOffset.UtcNow.AddDays(10);
        foreach (var (path, body) in new (string, object)[]
        {
            ("/api/contacts", new { Name = $"Tomás {word}", City = "Toronto" }),
            ("/api/partners", new { Name = $"Kestrel {word}", Website = "kestrel.example", Offering = "Venue", ContactName = "Nadia", Email = "nadia@kestrel.example", Phone = "416-555-0199", Notes = "" }),
            ("/api/events", new
            {
                title = $"Builders {word}", description = "An evening.", type = "builders-night", startsAt = start, endsAt = start.AddHours(2),
                city = "Toronto", format = "InPerson", venue = "Kestrel Labs", capacity = 60, visibility = "Public",
            }),
            ("/api/resources/links", new { Url = "https://www.canva.com/design/DAF123/edit", Title = $"Poster {word}", Description = "Template", Type = "template", Tags = new[] { "events" }, Visibility = "Global" }),
        })
        {
            (await lead.PostAsJsonAsync(path, body)).EnsureSuccessStatusCode();
        }

        var note = await (await lead.PostAsync("/api/notes", new { Title = $"Plan {word}" })).CreatedIdAsync();
        (await lead.PutAsJsonAsync($"/api/notes/{note}/visibility", new { Visibility = "Global" })).EnsureSuccessStatusCode();
        var own = factory.ClientOn(northside, await factory.AddMemberAsync(northside, "Cal Lima", Role.SystemAdmin));
        var admin = await factory.FaithTechAdminAsync();

        var there = await own.GetFromJsonAsync<Results>($"/api/search?q={word}");
        var here = await admin.GetFromJsonAsync<Results>($"/api/search?q={word}");

        Assert.Contains(there!.Groups, g => g.Kind == "Person");
        Assert.Contains(there.Groups, g => g.Kind == "Partner");
        Assert.Empty(here!.Groups.SelectMany(g => g.Items));
    }
}
