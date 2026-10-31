using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Invites;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations.Isolation;

// Traces to: L2-130 AC2, AC3, AC7. A record made in another organisation is never listed in FaithTech, and asking for
// its id, link or token in FaithTech answers 404 or the feature's unknown outcome, even for a System Admin.
public class FeatureIsolationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly DateTimeOffset Start = DateTimeOffset.UtcNow.AddDays(10);

    [Fact]
    public async Task Contacts()
    {
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var marker = Isolation.Marker();
        var id = await (await northside.PostAsync("/api/contacts",
            new { Name = marker, Email = (string?)null, Phone = (string?)null, Organization = (string?)null, City = "Toronto", Notes = (string?)null })).CreatedIdAsync();
        var admin = await factory.FaithTechAdminAsync();

        await admin.AssertNotFoundAsync($"/api/contacts/{id}");
        await admin.AssertNotFoundAsync($"/api/contacts/{id}/notes");
        await admin.AssertListLacksAsync("/api/contacts", marker);
        await admin.AssertListLacksAsync("/api/contacts/archived", marker);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync($"/api/contacts/{id}/archive", new { })).StatusCode);
    }

    [Fact]
    public async Task Partners()
    {
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var marker = Isolation.Marker();
        var id = await (await northside.PostAsync("/api/partners", Partner(marker))).CreatedIdAsync();
        var admin = await factory.FaithTechAdminAsync();

        await admin.AssertNotFoundAsync($"/api/partners/{id}");
        await admin.AssertNotFoundAsync($"/api/partners/{id}/activities");
        await admin.AssertNotFoundAsync($"/api/partners/{id}/duplicates");
        await admin.AssertListLacksAsync("/api/partners", marker);
    }

    [Fact]
    public async Task Events_including_the_public_page_and_the_calendar_file()
    {
        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        var marker = Isolation.Marker();
        var id = await (await northside.PostAsync("/api/events", new
        {
            title = marker, description = "An evening.", type = "BuildersNight", startsAt = Start, endsAt = Start.AddHours(2),
            city = "Toronto", format = "InPerson", venue = "Kestrel Labs", onlineLink = (string?)null, capacity = 60, visibility = "Public",
        })).CreatedIdAsync();
        var admin = await factory.FaithTechAdminAsync();
        var anonymous = factory.CreateClient();

        await admin.AssertNotFoundAsync($"/api/events/{id}");
        await admin.AssertNotFoundAsync($"/api/events/{id}/calendar.ics");
        await admin.AssertListLacksAsync("/api/events", marker);
        await admin.AssertListLacksAsync("/api/events?filter=past", marker);
        await anonymous.AssertNotFoundAsync($"/api/public/events/{id}");
        await anonymous.AssertNotFoundAsync($"/api/public/events/{id}/calendar.ics");
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.PostAsync($"/api/public/events/{id}/rsvps",
            new { Name = "Guest", Email = "guest@example.org" })).StatusCode);
    }

    [Fact]
    public async Task Invites()
    {
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var email = $"{Guid.NewGuid():N}@example.org";
        (await northside.PostAsync("/api/invites", new { Email = email })).EnsureSuccessStatusCode();
        var other = await factory.AddOrganisationAsync();
        var id = await factory.WithDbAsync(other.Id, db => db.Invites.Where(i => i.Email == email).Select(i => i.Id).SingleAsync());
        var admin = await factory.FaithTechAdminAsync();

        await admin.AssertListLacksAsync("/api/invites", email);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync($"/api/invites/{id}/revoke", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync($"/api/invites/{id}/resend", new { })).StatusCode);
    }

    [Fact]
    public async Task Connect_links()
    {
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var link = await northside.GetFromJsonAsync<ConnectClients.LinkBody>("/api/connect/link");
        var token = ConnectClients.TokenFrom(link!.Url);

        var lookup = await factory.CreateClient().PostAsJsonAsync("/api/connect/lookup", new { token });

        Assert.Equal(HttpStatusCode.NotFound, lookup.StatusCode);
    }

    [Fact]
    public async Task Announcements_and_their_notifications()
    {
        var northside = await factory.NorthsideClientAsync(Role.CommunicationsLead);
        var marker = Isolation.Marker();
        (await northside.PostAsync("/api/announcements",
            new { Subject = marker, Body = "Same time, new venue.", AlsoEmail = false, Audience = new { Kind = "Everyone" } })).EnsureSuccessStatusCode();
        var member = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"));

        await member.AssertListLacksAsync("/api/announcements", marker);
        await member.AssertListLacksAsync("/api/notifications", marker);
        Assert.Equal(0, await factory.WithDbAsync(db => db.Notifications.CountAsync(n => n.Title.Contains(marker))));
    }

    [Fact]
    public async Task Resources()
    {
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var marker = Isolation.Marker();
        var id = await (await northside.PostAsync("/api/resources/links", new
        {
            Url = "https://www.canva.com/design/DAF123/edit", Title = marker, Description = "Canva template", Type = "Template",
            Tags = new[] { "events" }, Visibility = "Global",
        })).CreatedIdAsync();
        var admin = await factory.FaithTechAdminAsync();

        await admin.AssertNotFoundAsync($"/api/resources/{id}");
        await admin.AssertListLacksAsync("/api/resources", marker);
        await admin.AssertListLacksAsync("/api/resources/archived", marker);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync($"/api/resources/{id}/archive", new { })).StatusCode);
    }

    [Fact]
    public async Task Notes()
    {
        var northside = await factory.NorthsideClientAsync();
        var marker = Isolation.Marker();
        var id = await (await northside.PostAsync("/api/notes", new { Title = marker })).CreatedIdAsync();
        (await northside.PutAsJsonAsync($"/api/notes/{id}/visibility", new { Visibility = "Global" })).EnsureSuccessStatusCode();
        var admin = await factory.FaithTechAdminAsync();

        await admin.AssertNotFoundAsync($"/api/notes/{id}");
        await admin.AssertListLacksAsync("/api/notes", marker);
        await admin.AssertListLacksAsync($"/api/notes/links?q={marker}", marker);
    }

    [Fact]
    public async Task Workspaces_and_work_items_archived_or_not()
    {
        var northside = await factory.NorthsideClientAsync(Role.CityLead);
        var marker = Isolation.Marker();
        var workspace = await (await northside.PostAsync("/api/workspaces", new { Name = marker, Method = "Kanban" })).CreatedIdAsync();
        var item = await (await northside.PostAsync($"/api/workspaces/{workspace}/items", Task(marker))).CreatedIdAsync();
        var archived = await (await northside.PostAsync($"/api/workspaces/{workspace}/items", Task(marker + " old"))).CreatedIdAsync();
        (await northside.PostAsync($"/api/items/{archived}/archive", new { })).EnsureSuccessStatusCode();
        var admin = await factory.FaithTechAdminAsync();

        await admin.AssertNotFoundAsync($"/api/workspaces/{workspace}");
        await admin.AssertNotFoundAsync($"/api/workspaces/{workspace}/backlog");
        await admin.AssertNotFoundAsync($"/api/workspaces/{workspace}/archived-items");
        await admin.AssertNotFoundAsync($"/api/items/{item}");
        await admin.AssertListLacksAsync("/api/workspaces", marker);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync($"/api/items/{archived}/restore", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync($"/api/workspaces/{workspace}/archive", new { })).StatusCode);
    }

    [Fact]
    public async Task Reports_count_only_this_organisation()
    {
        var staff = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.Staff);
        var before = await staff.GetStringAsync("/api/reports/");

        var northside = await factory.NorthsideClientAsync(Role.CityLead, Role.EventLead);
        await factory.AddMemberAsync(await factory.AddOrganisationAsync(), "Ana Lima", Role.Volunteer);
        (await northside.PostAsync("/api/partners", Partner(Isolation.Marker()))).EnsureSuccessStatusCode();

        Assert.Equal(Without(before, "generatedAt"), Without(await staff.GetStringAsync("/api/reports/"), "generatedAt"));
    }

    [Fact]
    public async Task Audit_entries_belong_to_the_organisation_they_were_written_in()
    {
        var northside = await factory.AddOrganisationAsync();
        var admin = await factory.AddMemberAsync(northside, "Ana Lima", Role.SystemAdmin);
        var target = await factory.AddMemberAsync(northside, Isolation.Marker());
        (await factory.ClientOn(northside, admin)
            .PostAsJsonAsync($"/api/profiles/{target.ProfileId}/roles", new { Role = "Volunteer" })).EnsureSuccessStatusCode();
        var faithTech = await factory.FaithTechAdminAsync();

        await faithTech.AssertListLacksAsync("/api/admin/audit", target.ProfileId.ToString());
        Assert.Equal(1, await factory.WithDbAsync(northside.Id, db => db.AuditEntries.CountAsync(e => e.TargetId == target.ProfileId.ToString())));
    }

    private static object Partner(string name) => new
    {
        Name = name, Website = "kestrel.example", Offering = "Venue", OwnerId = (Guid?)null, ContactName = "Nadia Petrov",
        Email = "nadia@kestrel.example", Phone = "416-555-0199", Notes = "Studio", Stage = (string?)null,
    };

    private static object Task(string title) =>
        new { Kind = "Initiative", Title = title, Description = "", ParentId = (Guid?)null, AssigneeId = (Guid?)null, StoryPoints = (int?)null };

    private static string Without(string json, string property) =>
        Regex.Replace(json, $"\"{property}\":\"[^\"]*\",?", string.Empty);
}
