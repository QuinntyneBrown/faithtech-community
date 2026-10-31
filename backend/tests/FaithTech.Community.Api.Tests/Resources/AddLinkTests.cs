// Traces to: L2-058, L2-059
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Resources;

public class AddLinkTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static object Link(string? url, string? title = "Event poster template", string type = "template") =>
        new { Url = url, Title = title, Description = "Canva template", Type = type, Tags = new[] { "Events" }, Visibility = "Global" };

    [Fact]
    public async Task A_lead_adds_an_https_link_and_its_host_is_derived()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/resources/links", Link("https://www.canva.com/design/DAF123/edit"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var link = (await response.Content.ReadFromJsonAsync<Detail>())!;
        Assert.Equal(("https://www.canva.com/design/DAF123/edit", "canva.com", "template", "events"), (link.LinkUrl, link.LinkHost, link.Type, link.Tags.Single()));
        Assert.Null(link.FileName);
        var row = (await factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah")).ListResourcesAsync()).Items.Single(r => r.Id == link.Id);
        Assert.Equal(("canva.com", null), (row.LinkHost, row.Extension));
    }

    [Theory]
    [InlineData("http://canva.com/design/1")]
    [InlineData("canva.com/design/1")]
    [InlineData("javascript:alert(1)")]
    [InlineData("")]
    [InlineData(null)]
    public async Task A_link_that_is_not_an_absolute_https_url_is_refused(string? url)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/resources/links", Link(url));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Use a link that starts with https://.", (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["Url"].Single());
    }

    [Fact]
    public async Task A_link_needs_a_title_and_a_type()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/resources/links", Link("https://canva.com/d/1", title: " ", type: ""));

        var errors = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors;
        Assert.Equal(["Title", "Type"], errors.Keys.Order());
    }

    [Fact]
    public async Task Members_who_may_not_add_are_refused()
    {
        var volunteer = await factory.AddMemberAsync("Samuel Mensah");

        var response = await factory.ClientFor(volunteer, Role.Volunteer).PostAsJsonAsync("/api/resources/links", Link("https://canva.com/d/1"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task The_owner_changes_the_link_and_it_is_never_fetched()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.CityLead);
        var link = (await (await client.PostAsJsonAsync("/api/resources/links", Link("https://canva.com/d/1"))).Content.ReadFromJsonAsync<Detail>())!;

        var bad = await client.PutAsJsonAsync($"/api/resources/{link.Id}", new
        {
            link.Title, link.Description, link.Type, link.Tags, link.Visibility, Url = "http://docs.google.com/x",
        });
        var good = await client.PutAsJsonAsync($"/api/resources/{link.Id}", new
        {
            link.Title, link.Description, link.Type, link.Tags, link.Visibility, Url = "https://docs.google.com/spreadsheets/d/1",
        });

        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal("docs.google.com", (await good.Content.ReadFromJsonAsync<Detail>())!.LinkHost);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/resources/{link.Id}/file")).StatusCode);
    }
}
