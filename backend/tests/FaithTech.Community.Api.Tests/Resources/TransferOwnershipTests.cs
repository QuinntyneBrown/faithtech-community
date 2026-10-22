// Traces to: L2-064, L2-066
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Resources;

public class TransferOwnershipTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_system_admin_hands_a_resource_to_another_contributor_who_is_notified_and_it_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var pitch = await factory.AddFileAsync(grace, Deck(), new Dictionary<string, string> { ["visibility"] = "Private" }, ["partners"]);
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        factory.ClientFor(marcus, Role.EventLead);
        var priya = await factory.AddMemberAsync("Priya Shah");

        var response = await factory.ClientFor(priya, Role.SystemAdmin).PutAsJsonAsync($"/api/resources/{pitch.Id}/owner", new { OwnerId = marcus.ProfileId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = (await factory.ClientFor(marcus, Role.EventLead).GetFromJsonAsync<Detail>($"/api/resources/{pitch.Id}"))!;
        Assert.Equal((marcus.ProfileId, true, "Private", "partners", "city-launch-deck.pptx"), (page.OwnerId, page.CanEdit, page.Visibility, page.Tags.Single(), page.FileName));
        Assert.Equal(HttpStatusCode.NotFound, (await factory.ClientFor(grace, Role.CityLead).GetAsync($"/api/resources/{pitch.Id}")).StatusCode);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(e => e.Action == "resource.owner.transferred" && e.TargetId == pitch.Id.ToString()));
        Assert.Contains(grace.ProfileId.ToString(), entry.BeforeJson);
        Assert.Contains(marcus.ProfileId.ToString(), entry.AfterJson);
        var notification = await factory.WithDbAsync(db => db.Notifications.SingleAsync(n => n.RecipientId == marcus.ProfileId));
        Assert.Equal((NotificationKind.ResourceOwnershipTransferred, "Priya Shah made you the owner of city-launch-deck", $"/resources/{pitch.Id}"),
            (notification.Kind, notification.Title, notification.LinkPath));
        var email = await factory.WithDbAsync(db => db.Users.Where(u => u.Id == marcus.UserId).Select(u => u.Email!).SingleAsync());
        Assert.Single(await factory.QueuedEmailsToAsync(email));
    }

    [Fact]
    public async Task The_new_owner_must_be_chosen_and_able_to_own_resources()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var volunteer = await factory.AddMemberAsync("Samuel Mensah");
        factory.ClientFor(volunteer, Role.Volunteer);
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);

        var none = await admin.PutAsJsonAsync($"/api/resources/{deck.Id}/owner", new { OwnerId = (Guid?)null });
        var notContributor = await admin.PutAsJsonAsync($"/api/resources/{deck.Id}/owner", new { OwnerId = volunteer.ProfileId });

        Assert.Equal("Choose who should own it.", (await none.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["OwnerId"].Single());
        Assert.Equal(HttpStatusCode.BadRequest, notContributor.StatusCode);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    public async Task Anyone_but_a_system_admin_is_refused_even_the_owner(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck(), role: role);
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        factory.ClientFor(marcus, Role.CityLead);

        var response = await factory.ClientFor(grace, role).PutAsJsonAsync($"/api/resources/{deck.Id}/owner", new { OwnerId = marcus.ProfileId });
        var candidates = await factory.ClientFor(grace, role).GetAsync("/api/resources/owner-candidates");

        Assert.Equal((HttpStatusCode.Forbidden, HttpStatusCode.Forbidden), (response.StatusCode, candidates.StatusCode));
    }

    [Fact]
    public async Task Owner_candidates_are_members_who_can_own_resources_staff_included()
    {
        var esther = await factory.AddMemberAsync("Zed Staffer");
        factory.ClientFor(esther, Role.Staff);
        var volunteer = await factory.AddMemberAsync("Zed Volunteer");
        factory.ClientFor(volunteer, Role.Volunteer);

        var people = (await factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin)
            .GetFromJsonAsync<ShareResourceTests.Person[]>("/api/resources/owner-candidates?q=zed"))!;

        Assert.Equal(["Zed Staffer"], people.Select(p => p.Name));
    }
}
