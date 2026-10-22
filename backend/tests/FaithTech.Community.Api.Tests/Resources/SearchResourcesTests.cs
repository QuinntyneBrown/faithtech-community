// Traces to: L2-065
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;
using static FaithTech.Community.Api.Tests.Search.GlobalSearchTests;

namespace FaithTech.Community.Api.Tests.Resources;

public class SearchResourcesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Word() => "Sponsor" + Guid.NewGuid().ToString("N")[..8];

    private static async Task<Item[]> ResourcesFoundAsync(HttpClient client, string term)
    {
        var results = (await client.GetFromJsonAsync<Results>($"/api/search?q={Uri.EscapeDataString(term)}"))!;
        return results.Groups.SingleOrDefault(g => g.Kind == "Resource")?.Items ?? [];
    }

    [Fact]
    public async Task Resources_matching_the_term_are_grouped_with_type_extension_owner_and_why_they_matched()
    {
        var word = Word().ToLowerInvariant();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck("launch.pptx"), tags: [word]);
        var client = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"));

        var item = Assert.Single(await ResourcesFoundAsync(client, word));

        Assert.Equal((deck.Id, "launch", $"/resources/{deck.Id}"), (item.Id, item.Title, item.Route));
        Assert.Equal($"Deck · PPTX · Grace Okonkwo · tagged {word}", item.Snippet);
        Assert.Null(item.Badge);
    }

    [Fact]
    public async Task Search_never_returns_resources_the_caller_may_not_open_or_archived_ones()
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var daniel = await factory.AddMemberAsync("Daniel Reyes");
        var priv = await factory.AddFileAsync(grace, new Upload($"{word}-budget.pdf", Pdf), new Dictionary<string, string> { ["visibility"] = "Private" });
        var shared = await factory.AddFileAsync(grace, new Upload($"{word}-pitch.pdf", Pdf),
            new Dictionary<string, string> { ["visibility"] = "Shared", ["memberIds"] = daniel.ProfileId.ToString() });
        var archived = await factory.AddFileAsync(grace, new Upload($"{word}-old.pdf", Pdf));
        await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/resources/{archived.Id}/archive", null);

        var other = await ResourcesFoundAsync(factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead), word);
        var recipient = await ResourcesFoundAsync(factory.ClientFor(daniel), word);
        var owner = await ResourcesFoundAsync(factory.ClientFor(grace), word);

        Assert.Empty(other);
        Assert.Equal([(shared.Id, "Shared with you")], recipient.Select(i => (i.Id, i.Badge)));
        Assert.Equal([priv.Id, shared.Id], owner.Select(i => i.Id).Order());
        Assert.Equal("Private", owner.Single(i => i.Id == priv.Id).Badge);
    }

    [Fact]
    public async Task A_link_shows_its_host_and_an_edit_shows_up_at_once()
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.CityLead);
        var response = await client.PostAsJsonAsync("/api/resources/links", new
        {
            Url = "https://canva.com/d/1", Title = "Poster template", Description = $"For the {word} night", Type = "Template", Visibility = "Global",
        });
        var link = (await response.Content.ReadFromJsonAsync<Detail>())!;

        var found = Assert.Single(await ResourcesFoundAsync(client, word));
        Assert.Equal($"Template · canva.com · Grace Okonkwo · description mentions {word}", found.Snippet);

        await client.PutAsJsonAsync($"/api/resources/{link.Id}", new { Title = $"Poster {word}", link.Type, link.Visibility, Url = link.LinkUrl });
        Assert.Equal($"Poster {word}", Assert.Single(await ResourcesFoundAsync(client, word)).Title);
    }
}
