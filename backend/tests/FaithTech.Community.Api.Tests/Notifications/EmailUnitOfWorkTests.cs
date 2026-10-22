// Traces to: L2-028 AC1, L2-047 (issue #174: an action and its queued email commit together or not at all)
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Agile;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Notifications;

/// <summary>
/// Runs each email producer with a save that fails before anything is written, and checks that the action it reports
/// is never left behind without its outbox email.
/// </summary>
public class EmailUnitOfWorkTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);

    [Fact]
    public async Task An_invite_and_its_email_commit_together()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";

        var response = await ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/invites", new { Email = email });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.Invites.AnyAsync(i => i.Email == email)));
        Assert.Single(await QueuedForAsync(email));
    }

    [Fact]
    public async Task An_invite_whose_email_cannot_be_queued_is_not_saved_either()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/invites", new { Email = email });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.Invites.AnyAsync(i => i.Email == email)));
        Assert.Empty(await QueuedForAsync(email));
    }

    [Fact]
    public async Task A_role_change_whose_email_cannot_be_queued_is_not_saved_either()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { Role = "Volunteer" });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.Profiles.AnyAsync(p => p.Id == ruth.ProfileId && p.Roles.Any())));
        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == ruth.ProfileId)));
        Assert.Empty(await QueuedForAsync(await EventClients.EmailOfAsync(factory, ruth)));
    }

    [Fact]
    public async Task An_rsvp_whose_confirmation_cannot_be_queued_is_not_saved_either()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week);
        var leah = await factory.AddMemberAsync("Leah Thompson");
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await ClientFor(leah).PostAsync($"/api/events/{existing.Id}/rsvps", null);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain((await factory.LoadEventAsync(existing.Id)).Rsvps, r => r.ProfileId == leah.ProfileId);
        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == leah.ProfileId)));
        Assert.Empty(await QueuedForAsync(await EventClients.EmailOfAsync(factory, leah)));
    }

    [Fact]
    public async Task A_guest_rsvp_whose_confirmation_cannot_be_queued_is_not_saved_either()
    {
        var existing = await factory.AddEventAsync("Open Demo Night", Week, visibility: EventVisibility.Public);
        var email = $"{Guid.NewGuid():N}@example.org";
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await factory.CreateClient()
            .PostAsJsonAsync($"/api/public/events/{existing.Id}/rsvps", new { Name = "Sam Guest", Email = email });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain((await factory.LoadEventAsync(existing.Id)).Rsvps, r => r.GuestEmail == email);
        Assert.Empty(await QueuedForAsync(email));
    }

    [Fact]
    public async Task A_cancelled_event_whose_emails_cannot_be_queued_is_not_cancelled_either()
    {
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var existing = await factory.AddEventAsync("Austin Faith and AI Panel", Week, members: [leah.ProfileId]);
        var lead = await factory.AddMemberAsync("Esther Nakamura");
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await ClientFor(lead, Role.EventLead)
            .PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { Reason = "Our venue fell through." });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.False((await factory.LoadEventAsync(existing.Id)).IsCancelled);
        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == leah.ProfileId)));
        Assert.Empty(await QueuedForAsync(await EventClients.EmailOfAsync(factory, leah)));
    }

    [Fact]
    public async Task A_workspace_member_whose_email_cannot_be_queued_is_not_added_either()
    {
        var cast = await factory.AddCastAsync();
        var marcus = await factory.AddWithRolesAsync("Marcus Chen", Role.Volunteer);
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await ClientFor(cast.Owner, Role.CityLead)
            .PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/members", new { ProfileIds = new[] { marcus.ProfileId } });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain((await factory.LoadWorkspaceAsync(cast.WorkspaceId)).Members, m => m.ProfileId == marcus.ProfileId);
        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == marcus.ProfileId)));
        Assert.Empty(await QueuedForAsync(await EventClients.EmailOfAsync(factory, marcus)));
    }

    private HttpClient ClientFor(ProfileClients.Member member, params Role[] roles) => factory.ClientFor(member, roles);

    private Task<List<OutboxMessage>> QueuedForAsync(string address) =>
        factory.WithDbAsync(db => db.OutboxMessages.Where(m => m.To == address).ToListAsync());

    private static bool QueuesEmail(DbContext context) =>
        context.ChangeTracker.Entries<OutboxMessage>().Any(e => e.State == EntityState.Added);
}
