// Traces to: L2-012, L2-013, L2-042
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

public class ManageContactsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task A_lead_creates_a_contact_and_it_appears_in_their_list(Role role)
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(lead, role);

        var response = await client.PostAsJsonAsync("/api/contacts", new
        {
            Name = "  Kwame Asante ",
            Email = "kwame.asante@example.org",
            Phone = "416-555-0101",
            Organization = "Maple Street Church",
            City = "Toronto",
            Notes = "Pastor. Interested in hosting a builders night in the spring.",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<Contact>())!;
        Assert.Equal(
            ("Kwame Asante", "kwame.asante@example.org", "416-555-0101", "Maple Street Church", "Toronto", 1, true),
            (created.Name, created.Email, created.Phone, created.Organization, created.City, created.NoteCount, created.IsOwn));
        var listed = Assert.Single(await client.ListContactsAsync());
        Assert.Equal((created.Id, "Kwame Asante", "Private"), (listed.Id, listed.Name, listed.Status));
    }

    [Fact]
    public async Task A_contact_without_a_name_or_with_an_invalid_email_is_rejected_field_by_field()
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(lead, Role.CityLead).PostAsJsonAsync("/api/contacts", NewContact(" ", "kwame@"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Equal(["Enter at least a first name."], problem.Errors["Name"]);
        Assert.Equal(["Enter an email like name@example.org, or leave it empty."], problem.Errors["Email"]);
        Assert.Empty(await factory.ClientFor(lead, Role.CityLead).ListContactsAsync());
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.ProductEngineer)]
    [InlineData(Role.Attendee)]
    public async Task Anyone_without_a_lead_role_or_system_admin_cannot_list_or_create_contacts(params Role[] roles)
    {
        var member = await factory.AddMemberAsync("Daniel Reyes");
        var client = factory.ClientFor(member, roles);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/contacts")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/contacts", NewContact("Kwame Asante"))).StatusCode);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.Staff)]
    [InlineData]
    public async Task Another_user_including_staff_gets_404_for_someone_elses_contact(params Role[] roles)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", "tomas.ortega@example.org");
        var other = await factory.AddMemberAsync("Marcus Lee");
        var client = factory.ClientFor(other, roles);

        var get = await client.GetAsync($"/api/contacts/{contact.Id}");
        var put = await client.PutAsJsonAsync($"/api/contacts/{contact.Id}", NewContact("Changed"));

        Assert.Equal((HttpStatusCode.NotFound, HttpStatusCode.NotFound), (get.StatusCode, put.StatusCode));
        Assert.Equal("Tomás Ortega", (await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<Contact>($"/api/contacts/{contact.Id}"))!.Name);
    }

    [Fact]
    public async Task An_unknown_contact_is_404()
    {
        var lead = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(lead, Role.CityLead).GetAsync($"/api/contacts/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_system_admin_reads_any_contact_and_the_read_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", "tomas.ortega@example.org");
        var admin = await factory.AddMemberAsync("Priya Shah");

        var read = await factory.ClientFor(admin, Role.SystemAdmin).GetFromJsonAsync<Contact>($"/api/contacts/{contact.Id}");

        Assert.Equal(("Tomás Ortega", false), (read!.Name, read.IsOwn));
        var entry = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking().SingleAsync(e => e.TargetId == contact.Id.ToString()));
        Assert.Equal(("contact.viewed", "Contact", admin.ProfileId), (entry.Action, entry.TargetType, entry.ActorId));
        var log = await factory.ClientFor(admin, Role.SystemAdmin).GetStringAsync($"/api/admin/audit?category=contacts&actor={admin.ProfileId}");
        Assert.Contains("Opened Tomás Ortega, another lead’s private contact", log);
    }

    [Fact]
    public async Task The_owner_reading_their_own_contact_writes_no_audit_entry()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");

        await factory.ClientFor(grace, Role.CityLead, Role.SystemAdmin).GetFromJsonAsync<Contact>($"/api/contacts/{contact.Id}");

        Assert.False(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(e => e.TargetId == contact.Id.ToString())));
    }

    [Fact]
    public async Task A_lead_lists_only_their_own_contacts_by_name()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        await factory.CreateContactAsync(grace, "Tomás Ortega");
        await factory.CreateContactAsync(grace, "Abby Brooks");
        await factory.CreateContactAsync(marcus, "Ruth Alvarez");

        var listed = await factory.ClientFor(grace, Role.CityLead).ListContactsAsync();

        Assert.Equal(["Abby Brooks", "Tomás Ortega"], listed.Select(c => c.Name));
    }

    [Theory]
    [InlineData("harbour")]
    [InlineData("TOMAS.ORTEGA@")]
    [InlineData("tomás")]
    [InlineData("bed availability")]
    public async Task Search_matches_name_email_organisation_or_notes_within_the_callers_contacts(string term)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        await factory.CreateContactAsync(grace, "Tomás Ortega", "tomas.ortega@example.org",
            "Interested in a data dashboard for bed availability.", "Harbour Light Shelter");
        await factory.CreateContactAsync(grace, "Abby Brooks", "abby@example.org", "UX designer.", "Ellis Design Studio");
        await factory.CreateContactAsync(marcus, "Tomás Harbour", "tomas.ortega@example.net", "bed availability", "Harbour Coffee");

        var found = await factory.ClientFor(grace, Role.CityLead).ListContactsAsync(term);

        Assert.Equal(["Tomás Ortega"], found.Select(c => c.Name));
    }

    [Fact]
    public async Task The_owner_edits_a_contact()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", "tomas.ortega@example.org");
        var client = factory.ClientFor(grace, Role.CityLead);

        var response = await client.PutAsJsonAsync($"/api/contacts/{contact.Id}", new
        {
            Name = "Tomás Ortega",
            Email = "",
            Phone = "416-555-0142",
            Organization = "Harbour Light Shelter",
            City = "Hamilton",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = (await response.Content.ReadFromJsonAsync<Contact>())!;
        Assert.Equal(((string?)null, "416-555-0142", "Harbour Light Shelter", "Hamilton"), (updated.Email, updated.Phone, updated.Organization, updated.City));
        var owner = await factory.WithDbAsync(db => db.Set<Domain.Contacts.Contact>().Where(c => c.Id == contact.Id).Select(c => c.OwnerId).SingleAsync());
        Assert.Equal(grace.ProfileId, owner);
    }

    [Fact]
    public async Task A_system_admin_editing_someone_elses_contact_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        var admin = await factory.AddMemberAsync("Priya Shah");

        var response = await factory.ClientFor(admin, Role.SystemAdmin).PutAsJsonAsync($"/api/contacts/{contact.Id}", NewContact("Tomás A. Ortega"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking().SingleAsync(e => e.TargetId == contact.Id.ToString()));
        Assert.Equal(("contact.updated", admin.ProfileId), (entry.Action, entry.ActorId));
    }
}
