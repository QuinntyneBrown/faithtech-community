// Traces to: L2-141 AC1, AC2, AC4, AC5; L2-140 AC2; L2-133 AC1 (docs/detailed-designs/organisations/chapters)
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// The chapter tag on profiles and events: a reference to one of the organisation's chapters in place of free-text cities.
public class ChapterTagsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly DateTimeOffset Start = new(2030, 3, 4, 18, 0, 0, TimeSpan.Zero);

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return Assert.Single((await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
    }

    private static object EventBody(Guid? chapterId) => new
    {
        title = "Builders Night",
        description = "An evening for Christians who build.",
        type = "BuildersNight",
        startsAt = Start,
        endsAt = Start.AddHours(2),
        chapterId,
        format = "InPerson",
        venue = "Kestrel Labs, 220 King St W",
        onlineLink = (string?)null,
        capacity = (int?)null,
        visibility = "Public",
    };

    // L2-141 AC1: the home chapter is a pick from the active chapters; the profile shows its name and the change is audited.
    [Fact]
    public async Task A_member_picks_a_home_chapter_and_the_profile_shows_its_name()
    {
        var toronto = await factory.AddChapterAsync($"Toronto {Guid.NewGuid():N}"[..14]);
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);

        (await client.PutAsJsonAsync($"/api/profiles/{grace.ProfileId}", new { Name = "Grace Okonkwo", ChapterId = toronto.Id, Bio = "" }))
            .EnsureSuccessStatusCode();

        var profile = await client.GetFromJsonAsync<JsonElement>($"/api/profiles/{grace.ProfileId}");
        Assert.Equal(toronto.Id, profile.GetProperty("chapterId").GetGuid());
        Assert.Equal(toronto.Name, profile.GetProperty("chapterName").GetString());
        var me = await client.GetFromJsonAsync<JsonElement>("/api/me");
        Assert.Equal(toronto.Name, me.GetProperty("chapter").GetProperty("name").GetString());

        (await client.PutAsJsonAsync($"/api/profiles/{grace.ProfileId}", new { Name = "Grace Okonkwo", ChapterId = (Guid?)null, Bio = "" }))
            .EnsureSuccessStatusCode();
        var cleared = await client.GetFromJsonAsync<JsonElement>($"/api/profiles/{grace.ProfileId}");
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("chapterName").ValueKind);
    }

    // L2-141 AC1: an archived chapter is not offered, but a member already tagged with it keeps it; another
    // organisation's chapter is not found.
    [Fact]
    public async Task An_archived_or_foreign_chapter_is_refused_but_a_current_archived_one_is_kept()
    {
        var halifax = await factory.AddChapterAsync($"Halifax {Guid.NewGuid():N}"[..14]);
        var archived = await factory.AddChapterAsync($"Regina {Guid.NewGuid():N}"[..14], archived: true);
        var northside = await factory.AddOrganisationAsync($"ct-{Guid.NewGuid():N}"[..10]);
        var foreign = await factory.AddChapterAsync("Downtown", organisationId: northside.Id);
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p => p.Update("Grace Okonkwo", archived.Id, null));
        var client = factory.ClientFor(grace);

        Assert.Equal("Choose a city from the list.", await FieldErrorAsync(
            await client.PutAsJsonAsync($"/api/profiles/{grace.ProfileId}", new { Name = "Grace", ChapterId = foreign.Id }), "ChapterId"));

        (await client.PutAsJsonAsync($"/api/profiles/{grace.ProfileId}", new { Name = "Grace", ChapterId = archived.Id }))
            .EnsureSuccessStatusCode();
        Assert.Equal(archived.Name, (await client.GetFromJsonAsync<JsonElement>($"/api/profiles/{grace.ProfileId}")).GetProperty("chapterName").GetString());

        (await client.PutAsJsonAsync($"/api/profiles/{grace.ProfileId}", new { Name = "Grace", ChapterId = halifax.Id }))
            .EnsureSuccessStatusCode();
        Assert.Equal("Choose a city from the list.", await FieldErrorAsync(
            await client.PutAsJsonAsync($"/api/profiles/{grace.ProfileId}", new { Name = "Grace", ChapterId = archived.Id }), "ChapterId"));
    }

    // L2-141 AC2: an event takes a chapter or none (organisation-wide); its page, the public page and the .ics show it.
    [Fact]
    public async Task An_event_takes_a_chapter_or_none_and_every_view_shows_it()
    {
        var austin = await factory.AddChapterAsync($"Austin {Guid.NewGuid():N}"[..14]);
        var lead = factory.ClientWithCapabilities(await factory.AddMemberAsync("Leah Park"), Capability.ManageEvents);

        var created = await lead.PostAsJsonAsync("/api/events", EventBody(austin.Id));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var page = await lead.GetFromJsonAsync<JsonElement>($"/api/events/{id}");
        Assert.Equal((austin.Id, austin.Name), (page.GetProperty("chapterId").GetGuid(), page.GetProperty("chapterName").GetString()));
        var visitor = await factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/public/events/{id}");
        Assert.Equal(austin.Name, visitor.GetProperty("chapterName").GetString());
        var ics = await lead.GetStringAsync($"/api/events/{id}/calendar.ics");
        Assert.Contains($"LOCATION:Kestrel Labs\\, 220 King St W\\, {austin.Name}", ics);
        var list = await lead.GetFromJsonAsync<JsonElement>("/api/events");
        Assert.Contains(list.GetProperty("events").EnumerateArray(), e => e.GetProperty("chapterName").GetString() == austin.Name);

        (await lead.PutAsJsonAsync($"/api/events/{id}", EventBody(null))).EnsureSuccessStatusCode();
        var wide = await lead.GetFromJsonAsync<JsonElement>($"/api/events/{id}");
        Assert.Equal(JsonValueKind.Null, wide.GetProperty("chapterName").ValueKind);
        Assert.Contains("LOCATION:Kestrel Labs\\, 220 King St W\r\n", await lead.GetStringAsync($"/api/events/{id}/calendar.ics"));

        var archived = await factory.AddChapterAsync($"Regina {Guid.NewGuid():N}"[..14], archived: true);
        Assert.Equal("Choose a city from the list.", await FieldErrorAsync(await lead.PostAsJsonAsync("/api/events", EventBody(archived.Id)), "ChapterId"));
    }

    // L2-140 AC2: with chapters off, nothing shows a chapter, and the tags come back with the label.
    [Fact]
    public async Task With_chapters_off_no_view_shows_a_chapter()
    {
        var organisation = await factory.AddOrganisationAsync($"co-{Guid.NewGuid():N}"[..10]);
        var admin = await factory.AddMemberAsync(organisation, "Grace Okonkwo", Role.SystemAdmin);
        var client = factory.ClientOn(organisation, admin);
        (await client.PutAsJsonAsync("/api/organisation", new { Name = "Northside", ShortName = "Northside", ChapterLabel = new { Singular = "Campus", Plural = "Campuses" } }))
            .EnsureSuccessStatusCode();
        var downtown = (await (await client.PostAsJsonAsync("/api/organisation/chapters", new { Name = "Downtown" })).Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();
        (await client.PutAsJsonAsync($"/api/profiles/{admin.ProfileId}", new { Name = "Grace Okonkwo", ChapterId = downtown })).EnsureSuccessStatusCode();

        (await client.PutAsJsonAsync("/api/organisation", new { Name = "Northside", ShortName = "Northside", ChapterLabel = (object?)null }))
            .EnsureSuccessStatusCode();
        var off = await client.GetFromJsonAsync<JsonElement>($"/api/profiles/{admin.ProfileId}");
        Assert.Equal(JsonValueKind.Null, off.GetProperty("chapterName").ValueKind);

        (await client.PutAsJsonAsync("/api/organisation", new { Name = "Northside", ShortName = "Northside", ChapterLabel = new { Singular = "Campus", Plural = "Campuses" } }))
            .EnsureSuccessStatusCode();
        var on = await client.GetFromJsonAsync<JsonElement>($"/api/profiles/{admin.ProfileId}");
        Assert.Equal("Downtown", on.GetProperty("chapterName").GetString());
        Assert.True(await factory.WithDbAsync(organisation.Id, db => db.Profiles.AnyAsync(p => p.Id == admin.ProfileId && p.ChapterId == downtown)));
    }

    // L2-141 AC4: person cards and pickers read the chapter's name, renamed or not.
    [Fact]
    public async Task The_team_list_shows_the_chapter_name_after_a_rename()
    {
        var vancouver = await factory.AddChapterAsync($"Vancouver {Guid.NewGuid():N}"[..14]);
        var samuel = await factory.AddMemberAsync("Samuel Mensah", p =>
        {
            p.Update("Samuel Mensah", vancouver.Id, null);
            p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow);
        });
        await factory.WithDbAsync(async db =>
        {
            var chapter = await db.Chapters.SingleAsync(c => c.Id == vancouver.Id);
            chapter.Rename("Vancouver Island");
            return await db.SaveChangesAsync();
        });

        var team = await factory.ClientFor(samuel).GetFromJsonAsync<JsonElement>("/api/team");
        var row = team.GetProperty("members").EnumerateArray().Single(m => m.GetProperty("profileId").GetGuid() == samuel.ProfileId);
        Assert.Equal("Vancouver Island", row.GetProperty("homeCity").GetString());
    }
}
