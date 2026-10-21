// Traces to: L2-016, L2-012
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

public class ArchiveContactsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task An_archived_contact_leaves_the_main_list_and_appears_in_archived_contacts()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter", notes: "Moved to Calgary.");
        await factory.CreateContactAsync(grace, "Abby Brooks");
        var client = factory.ClientFor(grace, Role.CityLead);

        var response = await client.PostAsync($"/api/contacts/{ben.Id}/archive", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(["Abby Brooks"], (await client.ListContactsAsync()).Select(c => c.Name));
        Assert.Empty(await client.ListContactsAsync("calgary"));
        var archived = Assert.Single((await client.GetFromJsonAsync<ContactSummary[]>("/api/contacts/archived"))!);
        Assert.Equal(("Ben Carter", factory.Time.GetUtcNow().UtcDateTime), (archived.Name, archived.ArchivedAtUtc));
    }

    [Fact]
    public async Task A_restored_contact_returns_to_the_main_list_with_its_notes()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter", notes: "Moved to Calgary.");
        var client = factory.ClientFor(grace, Role.CityLead);
        await client.PostAsync($"/api/contacts/{ben.Id}/archive", null);

        var response = await client.PostAsync($"/api/contacts/{ben.Id}/restore", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(["Ben Carter"], (await client.ListContactsAsync()).Select(c => c.Name));
        Assert.Empty((await client.GetFromJsonAsync<ContactSummary[]>("/api/contacts/archived"))!);
        Assert.Single((await client.GetFromJsonAsync<Note[]>($"/api/contacts/{ben.Id}/notes"))!);
    }

    [Fact]
    public async Task Archiving_twice_or_restoring_an_active_contact_is_a_conflict()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter");
        var client = factory.ClientFor(grace, Role.CityLead);

        var restore = await client.PostAsync($"/api/contacts/{ben.Id}/restore", null);
        await client.PostAsync($"/api/contacts/{ben.Id}/archive", null);
        var again = await client.PostAsync($"/api/contacts/{ben.Id}/archive", null);

        Assert.Equal((HttpStatusCode.Conflict, HttpStatusCode.Conflict), (restore.StatusCode, again.StatusCode));
    }

    [Fact]
    public async Task Deleting_an_archived_contact_removes_it_and_its_notes_permanently()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter", notes: "Moved to Calgary.");
        var client = factory.ClientFor(grace, Role.CityLead);
        await client.PostAsJsonAsync($"/api/contacts/{ben.Id}/notes", new { Body = "Second note." });
        await client.PostAsync($"/api/contacts/{ben.Id}/archive", null);

        var response = await client.DeleteAsync($"/api/contacts/{ben.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/contacts/{ben.Id}")).StatusCode);
        Assert.Equal(0, await factory.WithDbAsync(db => db.ContactNotes.CountAsync(n => n.ContactId == ben.Id)));
    }

    [Fact]
    public async Task An_active_contact_cannot_be_deleted()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter");

        var response = await factory.ClientFor(grace, Role.CityLead).DeleteAsync($"/api/contacts/{ben.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.Contacts.AnyAsync(c => c.Id == ben.Id)));
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    public async Task Nobody_else_archives_restores_or_deletes_a_contact(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter");
        var other = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), role);

        var archive = await other.PostAsync($"/api/contacts/{ben.Id}/archive", null);
        await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/contacts/{ben.Id}/archive", null);
        var restore = await other.PostAsync($"/api/contacts/{ben.Id}/restore", null);
        var delete = await other.DeleteAsync($"/api/contacts/{ben.Id}");

        Assert.Equal(
            (HttpStatusCode.NotFound, HttpStatusCode.NotFound, HttpStatusCode.NotFound),
            (archive.StatusCode, restore.StatusCode, delete.StatusCode));
        Assert.True(await factory.WithDbAsync(db => db.Contacts.AnyAsync(c => c.Id == ben.Id)));
    }

    [Fact]
    public async Task Archived_contacts_are_listed_only_to_their_owner_and_to_leads_only()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter");
        await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/contacts/{ben.Id}/archive", null);

        var marcus = await factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead).GetFromJsonAsync<ContactSummary[]>("/api/contacts/archived");
        var staff = await factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), Role.Staff).GetAsync("/api/contacts/archived");

        Assert.Empty(marcus!);
        Assert.Equal(HttpStatusCode.Forbidden, staff.StatusCode);
    }

    [Fact]
    public async Task A_system_admin_deleting_another_leads_contact_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ben = await factory.CreateContactAsync(grace, "Ben Carter");
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);

        await admin.PostAsync($"/api/contacts/{ben.Id}/archive", null);
        await admin.PostAsync($"/api/contacts/{ben.Id}/restore", null);
        await admin.PostAsync($"/api/contacts/{ben.Id}/archive", null);
        var delete = await admin.DeleteAsync($"/api/contacts/{ben.Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        var actions = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(e => e.TargetId == ben.Id.ToString()).Select(e => e.Action).ToListAsync());
        Assert.Equal(["contact.archived", "contact.archived", "contact.deleted", "contact.restored"], actions.Order());
    }
}
