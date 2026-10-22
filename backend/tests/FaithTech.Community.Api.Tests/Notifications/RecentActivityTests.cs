// Traces to: L2-049 (docs/detailed-designs/platform/home)
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Notifications;

public class RecentActivityTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly DateTimeOffset Noon = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);

    private record ActivityItem(Guid Id, string Kind, string Text, string LinkPath, DateTimeOffset OccurredAt);

    [Fact]
    public async Task Anonymous_visitor_gets_401_for_activity()
    {
        var response = await factory.CreateClient().GetAsync("/api/activity");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC7: the feed lists the newest notifications addressed to the member, newest first, each linking to its item.
    [Fact]
    public async Task Member_sees_their_own_notifications_newest_first_with_links()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await AddNotificationAsync(grace, NotificationKind.InviteAccepted, "Ruth Alvarez accepted your invite", "/people/ruth", Noon.AddDays(-3));
        await AddNotificationAsync(grace, NotificationKind.ContactSignedUp, "Tomás Ortega just joined FaithTech", "/contacts/tomas", Noon);
        await AddNotificationAsync(grace, NotificationKind.EventChanged, "Toronto Builders Night changed. Check the new details.", "/events/builders", Noon.AddDays(-1));

        var feed = await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<List<ActivityItem>>("/api/activity");

        Assert.Equal(
            ["Tomás Ortega just joined FaithTech", "Toronto Builders Night changed. Check the new details.", "Ruth Alvarez accepted your invite"],
            feed!.Select(i => i.Text));
        Assert.Equal(["/contacts/tomas", "/events/builders", "/people/ruth"], feed!.Select(i => i.LinkPath));
        Assert.Equal("ContactSignedUp", feed![0].Kind);
        Assert.Equal(Noon, feed![0].OccurredAt);
    }

    [Fact]
    public async Task Feed_holds_at_most_the_ten_newest_items()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        for (var i = 0; i < 12; i++)
        {
            await AddNotificationAsync(hannah, NotificationKind.RsvpConfirmed, $"You’re going to event {i}", $"/events/{i}", Noon.AddHours(i));
        }

        var feed = await factory.ClientFor(hannah, Role.Volunteer).GetFromJsonAsync<List<ActivityItem>>("/api/activity");

        Assert.Equal(10, feed!.Count);
        Assert.Equal("You’re going to event 11", feed[0].Text);
        Assert.Equal("You’re going to event 2", feed[^1].Text);
    }

    // AC7 and the private-contact rule (L2-012): another lead's contact sign-up never reaches Staff or anyone else.
    [Fact]
    public async Task Staff_and_other_members_never_see_notifications_addressed_to_someone_else()
    {
        var lead = await factory.AddMemberAsync("Marcus Lee");
        var staff = await factory.AddMemberAsync("Daniel Brooks");
        var volunteer = await factory.AddMemberAsync("Ruth Alvarez");
        await AddNotificationAsync(lead, NotificationKind.ContactSignedUp, "Private Person just joined FaithTech", "/contacts/private", Noon);

        var staffFeed = await factory.ClientFor(staff, Role.Staff).GetFromJsonAsync<List<ActivityItem>>("/api/activity");
        var volunteerFeed = await factory.ClientFor(volunteer, Role.Volunteer).GetFromJsonAsync<List<ActivityItem>>("/api/activity");
        var adminFeed = await factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin)
            .GetFromJsonAsync<List<ActivityItem>>("/api/activity");

        Assert.Empty(staffFeed!);
        Assert.Empty(volunteerFeed!);
        Assert.Empty(adminFeed!);
    }

    [Fact]
    public async Task Member_with_no_role_and_no_notifications_gets_an_empty_feed()
    {
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(leah).GetAsync("/api/activity");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await response.Content.ReadFromJsonAsync<List<ActivityItem>>())!);
    }

    private Task AddNotificationAsync(ProfileClients.Member to, NotificationKind kind, string title, string link, DateTimeOffset at) =>
        factory.WithDbAsync(async db =>
        {
            db.Notifications.Add(new Notification(to.ProfileId, kind, title, link, at));
            return await db.SaveChangesAsync();
        });
}
