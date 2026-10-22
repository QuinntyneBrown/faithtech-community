// Traces to: L2-085, L2-092
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class CreateAndListNotesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_member_with_no_role_creates_an_untitled_private_page_they_own()
    {
        var samuel = await factory.AddMemberAsync("Samuel Mensah");
        var client = factory.ClientFor(samuel);

        var response = await client.PostAsJsonAsync("/api/notes", new { });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var page = (await response.Content.ReadFromJsonAsync<Detail>())!;
        Assert.Equal(("", "Private", samuel.ProfileId, true, true, 1), (page.Title, page.Visibility, page.OwnerId, page.IsOwn, page.CanEdit, page.Version));
        Assert.Empty(page.Blocks);
        Assert.Equal($"/api/notes/{page.Id}", response.Headers.Location!.ToString());
    }

    [Fact]
    public async Task A_new_page_is_listed_for_its_owner_only()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.ClientFor(grace, Role.CityLead).CreateNoteAsync("Partner meeting notes");
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Esther Nakamura"), Role.Staff);

        var own = (await factory.ClientFor(grace).ListNotesAsync()).Items.Single(p => p.Id == page.Id);

        Assert.Equal(("Partner meeting notes", "Grace Okonkwo", true, "Private"), (own.Title, own.OwnerName, own.IsOwn, own.Visibility));
        Assert.DoesNotContain((await marcus.ListNotesAsync()).Items, p => p.Id == page.Id);
        Assert.DoesNotContain((await staff.ListNotesAsync()).Items, p => p.Id == page.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await marcus.GetAsync($"/api/notes/{page.Id}")).StatusCode);
    }

    [Fact]
    public async Task The_list_is_recently_edited_first_and_searches_titles()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var client = factory.ClientFor(hannah);
        await client.CreateNoteAsync("Volunteer onboarding checklist");
        factory.Time.Advance(TimeSpan.FromMinutes(5));
        await client.CreateNoteAsync("Builders Night run sheet");

        var all = await client.ListNotesAsync();
        var found = await client.ListNotesAsync("?q=onboarding");

        Assert.Equal(["Builders Night run sheet", "Volunteer onboarding checklist"], all.Items.Select(p => p.Title));
        Assert.Equal(["Volunteer onboarding checklist"], found.Items.Select(p => p.Title));
        Assert.Equal(25, all.PageSize);
    }

    [Fact]
    public async Task A_title_over_200_characters_is_refused()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Hannah Kim"));

        var response = await client.PostAsJsonAsync("/api/notes", new { Title = new string('a', 201) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_member_whose_email_is_not_verified_cannot_create_a_page()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.WithDbAsync(async db =>
        {
            var user = await db.Users.SingleAsync(u => u.Id == grace.UserId);
            user.EmailConfirmed = false;
            return await db.SaveChangesAsync();
        });

        var response = await factory.ClientFor(grace).PostAsJsonAsync("/api/notes", new { Title = "Notes" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("Verify your email before creating pages.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task An_anonymous_visitor_gets_401_for_every_notes_endpoint()
    {
        var client = factory.CreateClient();
        var id = Guid.NewGuid();

        foreach (var path in new[] { "/api/notes", $"/api/notes/{id}", "/api/notes/archived", "/api/notes/links", "/api/notes/members", $"/api/notes/{id}/images/{id}" })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path)).StatusCode);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/notes", new { })).StatusCode);
    }
}
