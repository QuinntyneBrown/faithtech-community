// Traces to: L2-014, L2-012
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

public class ContactNotesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_owner_adds_a_note_and_notes_are_shown_newest_first_with_their_time()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", notes: "Met at Builders Night.");
        var client = factory.ClientFor(grace, Role.CityLead);
        factory.Time.Advance(TimeSpan.FromDays(2));
        var addedAt = factory.Time.GetUtcNow().UtcDateTime;

        var response = await client.PostAsJsonAsync($"/api/contacts/{contact.Id}/notes", new { Body = "  Wants two staff at the hackathon. " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var note = (await response.Content.ReadFromJsonAsync<Note>())!;
        Assert.Equal(("Wants two staff at the hackathon.", addedAt), (note.Body, note.CreatedAtUtc));
        var notes = (await client.GetFromJsonAsync<Note[]>($"/api/contacts/{contact.Id}/notes"))!;
        Assert.Equal(["Wants two staff at the hackathon.", "Met at Builders Night."], notes.Select(n => n.Body));
    }

    [Theory]
    [InlineData("  ", "Write a note to save.")]
    [InlineData(null, "Write a note to save.")]
    public async Task An_empty_note_is_rejected(string? body, string message)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/contacts/{contact.Id}/notes", new { Body = body });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([message], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["Body"]);
    }

    [Fact]
    public async Task A_note_longer_than_2000_characters_is_rejected()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");

        var response = await factory.ClientFor(grace, Role.CityLead)
            .PostAsJsonAsync($"/api/contacts/{contact.Id}/notes", new { Body = new string('a', 2001) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    [InlineData]
    public async Task Nobody_else_reads_or_adds_notes(params Role[] roles)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", notes: "Private.");
        var other = await factory.AddMemberAsync("Marcus Lee");
        var client = factory.ClientFor(other, roles);

        var read = await client.GetAsync($"/api/contacts/{contact.Id}/notes");
        var add = await client.PostAsJsonAsync($"/api/contacts/{contact.Id}/notes", new { Body = "Mine now." });

        Assert.Equal((HttpStatusCode.NotFound, HttpStatusCode.NotFound), (read.StatusCode, add.StatusCode));
        Assert.Equal(1, await factory.WithDbAsync(db => db.ContactNotes.CountAsync(n => n.ContactId == contact.Id)));
    }

    [Fact]
    public async Task Notes_on_a_linked_contact_stay_with_the_lead_and_never_reach_the_member()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var tomas = await factory.AddMemberAsync("Tomás Ortega");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", notes: "Private follow-up.");
        await factory.WithDbAsync(async db =>
        {
            (await db.Contacts.SingleAsync(c => c.Id == contact.Id)).LinkTo(tomas.ProfileId);
            return await db.SaveChangesAsync();
        });

        var lead = (await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<Note[]>($"/api/contacts/{contact.Id}/notes"))!;
        var member = await factory.ClientFor(tomas, Role.CityLead).GetAsync($"/api/contacts/{contact.Id}/notes");

        Assert.Equal(["Private follow-up."], lead.Select(n => n.Body));
        Assert.Equal(HttpStatusCode.NotFound, member.StatusCode);
    }

    [Fact]
    public async Task A_system_admin_reading_or_adding_notes_on_another_leads_contact_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", notes: "Private.");
        var admin = await factory.AddMemberAsync("Priya Shah");
        var client = factory.ClientFor(admin, Role.SystemAdmin);

        var notes = (await client.GetFromJsonAsync<Note[]>($"/api/contacts/{contact.Id}/notes"))!;
        await client.PostAsJsonAsync($"/api/contacts/{contact.Id}/notes", new { Body = "Admin note." });

        Assert.Single(notes);
        var actions = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(e => e.TargetId == contact.Id.ToString() && e.ActorId == admin.ProfileId).Select(e => e.Action).ToListAsync());
        Assert.Equal(["contact.note-added", "contact.notes-viewed"], actions.Order());
    }
}
