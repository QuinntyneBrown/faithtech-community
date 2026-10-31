// Traces to: L2-060, L2-061, L2-066
using FaithTech.Community.Api.Tests.Organisations;
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Resources;

/// <summary>Each test owns its fixture, so role holders and notifications are only the test's own.</summary>
public class ShareResourceTests : IAsyncLifetime
{
    private readonly CommunityApiFactory factory = new();

    public Task InitializeAsync() => factory.InitializeAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    private static Dictionary<string, string> SharedWith(Guid? member = null) =>
        member is { } id ? new() { ["visibility"] = "Shared", ["memberIds"] = id.ToString() } : new() { ["visibility"] = "Shared" };

    private async Task<ProfileClients.Member> MemberWithRoleAsync(string name, Role role)
    {
        var member = await factory.AddMemberAsync(name);
        factory.ClientFor(member, role);
        return member;
    }

    private Task<List<Notification>> NotificationsAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Notifications.Where(n => n.RecipientId == member.ProfileId).ToListAsync());

    private async Task<IReadOnlyList<Application.Common.EmailMessage>> EmailsAsync(ProfileClients.Member member) =>
        await factory.QueuedEmailsToAsync(await factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync()));

    [Fact]
    public async Task A_resource_shared_with_a_member_is_visible_to_them_and_hidden_from_others()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var daniel = await factory.AddMemberAsync("Daniel Reyes");
        var pitch = await factory.AddFileAsync(grace, new Upload("partner-pitch.pdf", Pdf), SharedWith(daniel.ProfileId));
        var other = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"), Role.CityLead);

        var page = (await factory.ClientFor(daniel).GetFromJsonAsync<Detail>($"/api/resources/{pitch.Id}"))!;

        Assert.Equal(("Shared", true, "you", false), (page.Visibility, page.SharedWithYou, page.SharedVia, page.CanEdit));
        Assert.True((await factory.ClientFor(daniel).ListResourcesAsync()).Items.Single(r => r.Id == pitch.Id).SharedWithYou);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/resources/{pitch.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/resources/{pitch.Id}/file")).StatusCode);
        Assert.DoesNotContain((await other.ListResourcesAsync()).Items, r => r.Id == pitch.Id);
        var own = (await factory.ClientFor(grace).ListResourcesAsync()).Items.Single(r => r.Id == pitch.Id);
        Assert.False(own.SharedWithYou);
    }

    [Fact]
    public async Task A_role_in_the_audience_follows_role_changes_live()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var kit = await factory.AddFileAsync(grace, new Upload("volunteer-kit.pdf", Pdf), new Dictionary<string, string> { ["visibility"] = "Shared", ["roles"] = "Volunteer" });
        var samuel = await factory.AddMemberAsync("Samuel Mensah");

        Assert.Equal(HttpStatusCode.NotFound, (await factory.ClientFor(samuel).GetAsync($"/api/resources/{kit.Id}")).StatusCode);
        var volunteer = factory.ClientFor(samuel, Role.Volunteer);
        var page = (await volunteer.GetFromJsonAsync<Detail>($"/api/resources/{kit.Id}"))!;
        Assert.Equal("Volunteer", page.SharedVia);
        Assert.Empty(await NotificationsAsync(samuel));

        await factory.WithDbAsync(async db =>
        {
            (await db.Profiles.SingleAsync(p => p.Id == samuel.ProfileId)).RemoveRole(Role.Volunteer);
            return await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.NotFound, (await factory.ClientFor(samuel).GetAsync($"/api/resources/{kit.Id}")).StatusCode);
    }

    [Fact]
    public async Task Sharing_notifies_each_recipient_once_in_app_and_by_email_but_not_the_owner_or_suspended_members()
    {
        var grace = await MemberWithRoleAsync("Grace Okonkwo", Role.CityLead);
        var daniel = await MemberWithRoleAsync("Daniel Reyes", Role.Volunteer);
        var samuel = await MemberWithRoleAsync("Samuel Mensah", Role.Volunteer);
        var away = await MemberWithRoleAsync("Ruth Away", Role.Volunteer);
        await factory.WithDbAsync(async db =>
        {
            (await db.Profiles.SingleAsync(p => p.Id == away.ProfileId)).Suspend("Away", DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });
        var form = Form([new Upload("volunteer-kit.pdf", Pdf)],
            new Dictionary<string, string> { ["visibility"] = "Shared", ["title"] = "Volunteer kit" }, null);
        form.Add(new StringContent(daniel.ProfileId.ToString()), "memberIds");
        form.Add(new StringContent(grace.ProfileId.ToString()), "memberIds");
        form.Add(new StringContent("Volunteer"), "roles");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsync("/api/resources", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var kit = (await response.Content.ReadFromJsonAsync<Detail[]>())!.Single();
        foreach (var recipient in new[] { daniel, samuel })
        {
            var notification = Assert.Single(await NotificationsAsync(recipient));
            Assert.Equal((NotificationKind.ResourceShared, "Grace Okonkwo shared Volunteer kit with you", $"/resources/{kit.Id}", grace.ProfileId),
                (notification.Kind, notification.Title, notification.LinkPath, notification.ActorId));
            var email = Assert.Single(await EmailsAsync(recipient));
            Assert.Equal("Grace Okonkwo shared Volunteer kit with you", email.Subject);
            Assert.Contains("A resource was shared with you", email.Body);
        }

        Assert.Contains("“Volunteer kit” (Document, PDF, ", (await EmailsAsync(daniel)).Single().Body);
        Assert.Contains("with you.", (await EmailsAsync(daniel)).Single().Body);
        Assert.Contains("with everyone who has the Volunteer role, which includes you.", (await EmailsAsync(samuel)).Single().Body);
        Assert.Empty(await NotificationsAsync(grace));
        Assert.Empty(await NotificationsAsync(away));
        Assert.Equal(2, kit.Audience.Roles.Single().Count);
        Assert.Equal(["Daniel Reyes", "Grace Okonkwo"], kit.Audience.Members.Select(m => m.Name));
    }

    [Fact]
    public async Task Changing_the_audience_notifies_only_the_new_recipients_and_going_global_notifies_nobody()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var daniel = await factory.AddMemberAsync("Daniel Reyes");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var pitch = await factory.AddFileAsync(grace, Deck(), SharedWith(daniel.ProfileId));
        var client = factory.ClientFor(grace, Role.CityLead);

        await client.PutAsJsonAsync($"/api/resources/{pitch.Id}", EditBody(pitch, visibility: "Shared", memberIds: [daniel.ProfileId, hannah.ProfileId]));
        var global = await client.PutAsJsonAsync($"/api/resources/{pitch.Id}", EditBody(pitch, visibility: "Global"));

        Assert.Single(await NotificationsAsync(daniel));
        Assert.Single(await NotificationsAsync(hannah));
        var after = (await global.Content.ReadFromJsonAsync<Detail>())!;
        Assert.Equal(("Global", 0), (after.Visibility, after.Audience.Members.Length));
    }

    [Fact]
    public async Task A_recipient_cannot_change_who_can_see_it()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var daniel = await factory.AddMemberAsync("Daniel Reyes");
        var pitch = await factory.AddFileAsync(grace, Deck(), SharedWith(daniel.ProfileId));
        var hannah = await factory.AddMemberAsync("Hannah Kim");

        var response = await factory.ClientFor(daniel, Role.CityLead)
            .PutAsJsonAsync($"/api/resources/{pitch.Id}", EditBody(pitch, visibility: "Shared", memberIds: [daniel.ProfileId, hannah.ProfileId]));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(await NotificationsAsync(hannah));
    }

    [Fact]
    public async Task Shared_with_nobody_or_an_unknown_member_or_role_is_refused()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, Role.CityLead);

        var nobody = await client.UploadAsync(Deck(), SharedWith());
        var unknown = await client.UploadAsync(Deck(), SharedWith(Guid.NewGuid()));
        var admins = await client.UploadAsync(Deck(), new Dictionary<string, string> { ["visibility"] = "Shared", ["roles"] = "SystemAdmin" });

        Assert.Equal("Choose at least one person or role, or pick another visibility.",
            (await nobody.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["Visibility"].Single());
        Assert.Equal((HttpStatusCode.BadRequest, HttpStatusCode.BadRequest), (unknown.StatusCode, admins.StatusCode));
    }

    [Fact]
    public async Task Staff_share_their_own_resources_and_can_be_shared_with_as_a_role()
    {
        var esther = await MemberWithRoleAsync("Esther Nakamura", Role.Staff);
        var ruth = await MemberWithRoleAsync("Ruth Staff", Role.Staff);
        var marcus = await factory.AddMemberAsync("Marcus Lee");

        var response = await factory.ClientFor(esther, Role.Staff).UploadAsync(Deck(), new Dictionary<string, string> { ["visibility"] = "Shared", ["roles"] = "Staff", ["memberIds"] = marcus.ProfileId.ToString() });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(await NotificationsAsync(ruth));
        Assert.Single(await NotificationsAsync(marcus));
    }

    [Fact]
    public async Task The_people_picker_lists_members_by_name_with_roles_and_city_for_contributors_only()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var austin = await factory.ChapterIdAsync("Austin");
        await factory.AddMemberAsync("Daniel Reyes", p => p.Update("Daniel Reyes", austin, null));
        var away = await factory.AddMemberAsync("Daniel Away");
        await factory.WithDbAsync(async db =>
        {
            (await db.Profiles.SingleAsync(p => p.Id == away.ProfileId)).Suspend("Away", DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });

        var people = (await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<Person[]>("/api/resources/members?q=dan"))!;
        var refused = await factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"), Role.Volunteer).GetAsync("/api/resources/members?q=dan");

        Assert.Equal([("Daniel Reyes", "Austin")], people.Select(p => (p.Name, p.City)));
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
    }

    public sealed record Person(Guid Id, string Name, string? City, string[] Roles);
}
