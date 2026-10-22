// Traces to: L2-028 AC1, L2-047 (issue #174: an action and its queued email commit together)
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Notifications;

public class EmailUnitOfWorkTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);

    [Fact]
    public async Task An_invite_and_its_email_commit_together()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/invites", new { Email = email });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.Invites.AnyAsync(i => i.Email == email)));
        Assert.Single(factory.Emails.SentTo(email));
    }

    [Fact]
    public async Task An_invite_whose_email_cannot_be_queued_is_not_saved_either()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/invites", new { Email = email });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.Invites.AnyAsync(i => i.Email == email)));
        Assert.Empty(factory.Emails.SentTo(email));
    }

    [Fact]
    public async Task A_role_change_whose_email_cannot_be_queued_is_not_saved_either()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await factory.ClientFor(grace, Role.CityLead)
            .PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { Role = "Volunteer" });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.Profiles.AnyAsync(p => p.Id == ruth.ProfileId && p.Roles.Any())));
        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == ruth.ProfileId)));
        Assert.Empty(factory.Emails.SentTo(await factory.EmailOfAsync(ruth)));
    }

    [Fact]
    public async Task An_rsvp_whose_confirmation_cannot_be_queued_is_not_saved_either()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week);
        var leah = await factory.AddMemberAsync("Leah Thompson");
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await factory.ClientFor(leah).PostAsync($"/api/events/{existing.Id}/rsvps", null);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain((await factory.LoadEventAsync(existing.Id)).Rsvps, r => r.ProfileId == leah.ProfileId);
        Assert.Empty(factory.Emails.SentTo(await factory.EmailOfAsync(leah)));
    }

    [Fact]
    public async Task A_cancelled_event_and_its_emails_commit_together()
    {
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var existing = await factory.AddEventAsync("Austin Faith and AI Panel", Week, members: [leah.ProfileId]);
        var lead = await factory.AddMemberAsync("Esther Nakamura");
        factory.SaveFailures.FailNext(QueuesEmail);

        var response = await factory.ClientFor(lead, Role.EventLead)
            .PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { Reason = "Our venue fell through." });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.False((await factory.LoadEventAsync(existing.Id)).IsCancelled);
        Assert.Empty(factory.Emails.SentTo(await factory.EmailOfAsync(leah)));
    }

    private static bool QueuesEmail(DbContext context) =>
        context.ChangeTracker.Entries<OutboxMessage>().Any(e => e.State == EntityState.Added);
}
