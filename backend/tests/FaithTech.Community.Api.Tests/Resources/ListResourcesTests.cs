// Traces to: L2-055, L2-059
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Resources;

/// <summary>Each test owns its own fixture, so the list holds only what the test adds.</summary>
public class ListResourcesTests : IAsyncLifetime
{
    private readonly CommunityApiFactory factory = new();

    public Task InitializeAsync() => factory.InitializeAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    [Fact]
    public async Task The_list_is_newest_first_25_at_a_time()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        for (var i = 1; i <= 27; i++)
        {
            await factory.AddFileAsync(grace, new Upload($"file-{i:00}.pdf", Pdf));
            factory.Time.Advance(TimeSpan.FromMinutes(1));
        }

        var client = factory.ClientFor(grace);
        var first = await client.ListResourcesAsync();
        var second = await client.ListResourcesAsync("?page=2");

        Assert.Equal((27, 25), (first.TotalCount, first.Items.Length));
        Assert.Equal("file-27", first.Items[0].Title);
        Assert.Equal(["file-02", "file-01"], second.Items.Select(i => i.Title));
    }

    [Fact]
    public async Task Type_tag_and_search_filters_combine()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.AddFileAsync(grace, Deck("hackathon-kickoff.pptx"), tags: ["hackathon", "events"]);
        await factory.AddFileAsync(grace, new Upload("judging-rubric.pdf", Pdf), new Dictionary<string, string> { ["description"] = "How judges score a hackathon." }, ["hackathon"]);
        await factory.AddFileAsync(grace, Deck("city-launch.pptx"), tags: ["launch"]);
        var client = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"));

        Assert.Equal(["judging-rubric", "hackathon-kickoff"], (await client.ListResourcesAsync("?tag=hackathon")).Items.Select(i => i.Title));
        Assert.Equal(["hackathon-kickoff"], (await client.ListResourcesAsync("?tag=hackathon&type=Deck")).Items.Select(i => i.Title));
        Assert.Equal(["judging-rubric"], (await client.ListResourcesAsync("?q=judges")).Items.Select(i => i.Title));
        Assert.Equal(["city-launch"], (await client.ListResourcesAsync("?q=launch.pptx")).Items.Select(i => i.Title));
        Assert.Equal(2, (await client.ListResourcesAsync("?q=hackathon")).TotalCount);
    }

    [Fact]
    public async Task Tags_in_use_are_suggested_with_how_many_resources_use_them()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.AddFileAsync(grace, Deck(), tags: ["launch", "brand"]);
        await factory.AddFileAsync(grace, Deck(), tags: ["launch"]);
        await factory.AddFileAsync(grace, Deck(), new Dictionary<string, string> { ["visibility"] = "Private" }, ["secret-launch"]);
        var client = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"));

        var all = (await client.GetFromJsonAsync<Tag[]>("/api/resources/tags"))!;
        var matching = (await client.GetFromJsonAsync<Tag[]>("/api/resources/tags?q=lau"))!;

        Assert.Equal([new Tag("brand", 1), new Tag("launch", 2)], all);
        Assert.Equal([new Tag("launch", 2)], matching);
    }
}
