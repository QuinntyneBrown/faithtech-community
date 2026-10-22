// Traces to: L2-092, L2-093, L2-098 AC1-AC2
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

/// <summary>Each test owns its fixture, so role holders and notifications are only the test's own.</summary>
public class ShareNoteTests : IAsyncLifetime
{
    private readonly CommunityApiFactory factory = new();

    public Task InitializeAsync() => factory.InitializeAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    private Task<List<Notification>> NotificationsAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Notifications.Where(n => n.RecipientId == member.ProfileId).ToListAsync());

    private async Task<IReadOnlyList<Application.Common.EmailMessage>> EmailsAsync(ProfileClients.Member member) =>
        await factory.QueuedEmailsToAsync(await factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync()));

    private static Task<HttpResponseMessage> ShareAsync(HttpClient client, Guid id, string visibility, Guid[]? members = null, string[]? roles = null) =>
        client.PutAsJsonAsync($"/api/notes/{id}/visibility", new { Visibility = visibility, MemberIds = members ?? [], Roles = roles ?? [] });

    [Fact]
    public async Task Sharing_with_a_member_and_a_role_lets_them_read_it_and_tells_each_of_them()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var samuel = await factory.AddMemberAsync("Samuel Mensah");
        factory.ClientFor(samuel, Role.Volunteer);
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead);
        var client = factory.ClientFor(grace);
        var page = await client.CreateNoteAsync("Q4 planning notes");

        var response = await ShareAsync(client, page.Id, "Shared", [hannah.ProfileId], ["Volunteer"]);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var shared = (await response.Content.ReadFromJsonAsync<Detail>())!;
        Assert.Equal("Shared", shared.Visibility);
        Assert.Equal(["Hannah Kim"], shared.Audience.Members.Select(m => m.Name));
        Assert.Equal(["Volunteer"], shared.Audience.Roles.Select(r => r.Role));
        var asHannah = (await factory.ClientFor(hannah).GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;
        Assert.Equal(("you", false), (asHannah.SharedVia, asHannah.CanEdit));
        Assert.Equal("Volunteer", (await factory.ClientFor(samuel).GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!.SharedVia);
        Assert.Equal(HttpStatusCode.NotFound, (await marcus.GetAsync($"/api/notes/{page.Id}")).StatusCode);

        foreach (var recipient in new[] { hannah, samuel })
        {
            var notification = Assert.Single(await NotificationsAsync(recipient));
            Assert.Equal((NotificationKind.NotePageShared, "Grace Okonkwo shared Q4 planning notes with you", $"/notes/{page.Id}"),
                (notification.Kind, notification.Title, notification.LinkPath));
            var email = Assert.Single(await EmailsAsync(recipient));
            Assert.Equal("Grace Okonkwo shared Q4 planning notes with you", email.Subject);
            Assert.Contains("A page was shared with you", email.Body);
        }

        Assert.Contains("everyone who has the Volunteer role, which includes you", (await EmailsAsync(samuel))[0].Body);
        Assert.Empty(await NotificationsAsync(grace));
    }

    [Fact]
    public async Task Changing_the_audience_tells_only_the_new_recipients()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var daniel = await factory.AddMemberAsync("Daniel Reyes");
        var client = factory.ClientFor(grace);
        var page = await client.CreateNoteAsync("");

        (await ShareAsync(client, page.Id, "Shared", [hannah.ProfileId])).EnsureSuccessStatusCode();
        (await ShareAsync(client, page.Id, "Shared", [hannah.ProfileId, daniel.ProfileId])).EnsureSuccessStatusCode();

        Assert.Single(await NotificationsAsync(hannah));
        Assert.Equal("Grace Okonkwo shared Untitled with you", Assert.Single(await NotificationsAsync(daniel)).Title);
    }

    [Fact]
    public async Task Going_Global_or_Private_clears_the_audience_and_tells_nobody()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var client = factory.ClientFor(grace);
        var page = await client.CreateNoteAsync("Playbook");
        (await ShareAsync(client, page.Id, "Shared", [hannah.ProfileId])).EnsureSuccessStatusCode();

        var global = (await (await ShareAsync(client, page.Id, "Global", [hannah.ProfileId])).Content.ReadFromJsonAsync<Detail>())!;
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"));

        Assert.Equal(("Global", 0), (global.Visibility, global.Audience.Members.Length));
        Assert.Equal(HttpStatusCode.OK, (await marcus.GetAsync($"/api/notes/{page.Id}")).StatusCode);
        Assert.Single(await NotificationsAsync(hannah));
        (await ShareAsync(client, page.Id, "Private")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await marcus.GetAsync($"/api/notes/{page.Id}")).StatusCode);
    }

    [Fact]
    public async Task Shared_with_nobody_or_an_unknown_role_is_refused()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Playbook");

        var nobody = await ShareAsync(client, page.Id, "Shared");
        var admins = await ShareAsync(client, page.Id, "Shared", roles: ["SystemAdmin"]);
        var unknown = await ShareAsync(client, page.Id, "Everyone");

        Assert.Equal(HttpStatusCode.BadRequest, nobody.StatusCode);
        Assert.Contains("Choose at least one person or role, or pick another visibility.",
            (await nobody.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.SelectMany(e => e.Value));
        Assert.Equal(HttpStatusCode.BadRequest, admins.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
    }

    [Fact]
    public async Task A_recipient_cannot_share_it_on_and_Staff_cannot_share_what_they_do_not_own()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var page = await factory.AddNoteAsync(grace, "Playbook", "Global");
        await factory.ShareInDbAsync(page.Id, [hannah.ProfileId], []);

        Assert.Equal(HttpStatusCode.Forbidden, (await ShareAsync(factory.ClientFor(hannah), page.Id, "Global")).StatusCode);
        await factory.ShareInDbAsync(page.Id, [], [Role.Staff]);
        Assert.Equal(HttpStatusCode.Forbidden, (await ShareAsync(factory.ClientFor(esther, Role.Staff), page.Id, "Global")).StatusCode);
    }

    [Fact]
    public async Task Staff_create_and_share_their_own_pages()
    {
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var staff = factory.ClientFor(esther, Role.Staff);
        var page = await staff.CreateNoteAsync("Staff handbook");

        Assert.Equal(HttpStatusCode.OK, (await staff.SaveNoteAsync(page, [Paragraph("Welcome")])).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ShareAsync(staff, page.Id, "Global")).StatusCode);
    }

    [Fact]
    public async Task The_share_picker_offers_members_who_are_not_suspended()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.AddMemberAsync("Hannah Kim");
        await factory.AddMemberAsync("Hannah Suspended", p => p.Suspend("Left", DateTime.UtcNow));

        var found = (await factory.ClientFor(grace).GetFromJsonAsync<PickerMember[]>("/api/notes/members?q=hannah"))!;

        Assert.Equal(["Hannah Kim"], found.Select(f => f.Name));
    }

    private sealed record PickerMember(Guid Id, string Name, string? City, string[] Roles);
}
