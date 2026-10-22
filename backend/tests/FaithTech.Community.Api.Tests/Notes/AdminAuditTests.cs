// Traces to: L2-098 AC4-AC8, L2-092 AC10
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class AdminAuditTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private Task<List<string>> ActionsAsync(ProfileClients.Member actor, Guid pageId) =>
        factory.WithDbAsync(db => db.AuditEntries
            .Where(e => e.ActorId == actor.ProfileId && e.TargetId == pageId.ToString())
            .OrderBy(e => e.OccurredAtUtc).Select(e => e.Action).ToListAsync());

    [Fact]
    public async Task A_System_Admin_opening_a_private_page_they_do_not_own_is_audited_but_a_global_one_is_not()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var secret = await factory.AddNoteAsync(grace, "Partner meeting notes");
        var open = await factory.AddNoteAsync(grace, "Playbook", "Global");
        var priya = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientFor(priya, Role.SystemAdmin);

        var read = (await admin.GetFromJsonAsync<Detail>($"/api/notes/{secret.Id}"))!;
        await admin.GetAsync($"/api/notes/{open.Id}");

        Assert.Equal((true, true, false), (read.CanEdit, read.IsAdminView, read.IsOwn));
        Assert.Equal(["note.opened"], await ActionsAsync(priya, secret.Id));
        Assert.Empty(await ActionsAsync(priya, open.Id));
    }

    [Fact]
    public async Task Every_change_a_System_Admin_makes_to_someone_elses_page_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.AddNoteAsync(grace, "Run sheet", "Global");
        var parent = await factory.AddNoteAsync(grace, "Playbook", "Global");
        var priya = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientFor(priya, Role.SystemAdmin);

        (await admin.SaveNoteAsync(page, [Paragraph("Fixed the address")])).EnsureSuccessStatusCode();
        (await admin.PutAsJsonAsync($"/api/notes/{page.Id}/visibility", new { Visibility = "Private" })).EnsureSuccessStatusCode();
        (await admin.PutAsJsonAsync($"/api/notes/{page.Id}/parent", new { ParentId = parent.Id })).EnsureSuccessStatusCode();
        (await admin.PostAsync($"/api/notes/{page.Id}/archive", null)).EnsureSuccessStatusCode();
        (await admin.PostAsync($"/api/notes/{page.Id}/restore", null)).EnsureSuccessStatusCode();

        Assert.Equal(["note.edited", "note.shared", "note.moved", "note.archived", "note.restored"],
            (await ActionsAsync(priya, page.Id)).Where(a => a != "note.opened"));
        var edited = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(e => e.ActorId == priya.ProfileId && e.Action == "note.edited" && e.TargetId == page.Id.ToString()));
        Assert.Contains($"\"Version\":{page.Version}", edited.BeforeJson);
        Assert.Contains($"\"Version\":{page.Version + 1}", edited.AfterJson);
    }

    [Fact]
    public async Task Members_acting_on_their_own_pages_are_not_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.SystemAdmin);
        var page = await client.CreateNoteAsync("My notes");

        (await client.SaveNoteAsync(page, [Paragraph("Hello")])).EnsureSuccessStatusCode();
        await client.PostAsync($"/api/notes/{page.Id}/archive", null);

        Assert.Empty(await ActionsAsync(grace, page.Id));
    }

    [Fact]
    public async Task A_lead_cannot_change_another_members_page()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.AddNoteAsync(grace, "Playbook", "Global");
        var lead = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead, Role.EventLead, Role.CommunicationsLead);

        Assert.Equal(HttpStatusCode.Forbidden, (await lead.SaveNoteAsync(page, [Paragraph("Mine")])).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.PutAsJsonAsync($"/api/notes/{page.Id}/visibility", new { Visibility = "Private" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.PostAsync($"/api/notes/{page.Id}/archive", null)).StatusCode);
    }
}
