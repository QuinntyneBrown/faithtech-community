// Traces to: L2-027
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Notifications;

public class InAppNotificationsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly DateTimeOffset Monday = new(2026, 10, 20, 9, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData("GET", "/api/notifications")]
    [InlineData("GET", "/api/notifications/unread-count")]
    [InlineData("POST", "/api/notifications/read-all")]
    public async Task Anonymous_visitor_gets_401(string method, string url)
    {
        var response = await factory.CreateClient().SendAsync(new HttpRequestMessage(new HttpMethod(method), url));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC1: Given a new notification, when the user is signed in, then the bell shows an unread count, and the
    // panel lists notifications newest first.
    [Fact]
    public async Task Member_gets_their_own_notifications_newest_first_with_the_unread_count()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        await AddAsync(grace, "Older", Monday, read: true);
        await AddAsync(grace, "Newest", Monday.AddHours(2), actor: "Hannah Kim");
        await AddAsync(grace, "Middle", Monday.AddHours(1));
        await AddAsync(ruth, "Not Grace's", Monday.AddHours(3));
        var client = factory.ClientFor(grace);

        var page = await client.GetFromJsonAsync<NotificationPageResponse>("/api/notifications");
        var count = await client.GetFromJsonAsync<CountResponse>("/api/notifications/unread-count");

        Assert.Equal(["Newest", "Middle", "Older"], page!.Items.Select(n => n.Title));
        Assert.Equal(2, page.UnreadCount);
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(2, count!.Count);
        var newest = page.Items[0];
        Assert.Equal("Announcement", newest.Kind);
        Assert.Equal("/announcements", newest.LinkPath);
        Assert.Equal("Hannah Kim", newest.ActorName);
        Assert.Null(newest.ReadAt);
        Assert.NotNull(page.Items[2].ReadAt);
    }

    // AC6: Given more than 50 notifications, when the page loads, then the newest 50 are listed with "Show older
    // notifications", which appends the next 50 and disappears when none are left.
    [Fact]
    public async Task Notifications_come_fifty_to_a_page()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.WithDbAsync(async db =>
        {
            for (var i = 0; i < 53; i++)
            {
                db.Notifications.Add(new Notification(grace.ProfileId, NotificationKind.Announcement, $"Notice {i:00}", "/announcements", Monday.AddMinutes(i)));
            }

            return await db.SaveChangesAsync();
        });
        var client = factory.ClientFor(grace);

        var first = await client.GetFromJsonAsync<NotificationPageResponse>("/api/notifications");
        var second = await client.GetFromJsonAsync<NotificationPageResponse>("/api/notifications?page=2");

        Assert.Equal(50, first!.Items.Length);
        Assert.Equal("Notice 52", first.Items[0].Title);
        Assert.Equal(["Notice 02", "Notice 01", "Notice 00"], second!.Items.Select(n => n.Title));
        Assert.Equal(2, second.Page);
        Assert.Equal(50, second.PageSize);
        Assert.Equal(53, second.TotalCount);
    }

    // AC5: Given the notifications page, when the user chooses "Unread", then only unread notifications are
    // listed, and "All" lists every notification again.
    [Fact]
    public async Task Unread_only_lists_the_unread_notifications_and_counts_them()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await AddAsync(grace, "Read", Monday.AddHours(2), read: true);
        await AddAsync(grace, "Unread newer", Monday.AddHours(1));
        await AddAsync(grace, "Unread older", Monday);
        var client = factory.ClientFor(grace);

        var unread = await client.GetFromJsonAsync<NotificationPageResponse>("/api/notifications?unreadOnly=true");
        var all = await client.GetFromJsonAsync<NotificationPageResponse>("/api/notifications?unreadOnly=false");

        Assert.Equal(["Unread newer", "Unread older"], unread!.Items.Select(n => n.Title));
        Assert.Equal(2, unread.TotalCount);
        Assert.Equal(2, unread.UnreadCount);
        Assert.Equal(["Read", "Unread newer", "Unread older"], all!.Items.Select(n => n.Title));
    }

    // AC2: Given the panel, when the user opens a notification, then it is marked read and they are taken to
    // the related item.
    [Fact]
    public async Task Opening_a_notification_marks_only_it_read_and_keeps_the_first_read_time()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var opened = await AddAsync(grace, "Opened", Monday);
        var other = await AddAsync(grace, "Other", Monday.AddHours(1));
        var client = factory.ClientFor(grace);

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync($"/api/notifications/{opened}/read", null)).StatusCode);
        var firstRead = await ReadAtAsync(opened);
        factory.Time.Advance(TimeSpan.FromMinutes(5));
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync($"/api/notifications/{opened}/read", null)).StatusCode);

        Assert.NotNull(firstRead);
        Assert.Equal(firstRead, await ReadAtAsync(opened));
        Assert.Null(await ReadAtAsync(other));
        Assert.Equal(1, (await client.GetFromJsonAsync<CountResponse>("/api/notifications/unread-count"))!.Count);
    }

    [Fact]
    public async Task Another_members_notification_cannot_be_marked_read_and_is_404()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var ruths = await AddAsync(ruth, "For Ruth", Monday);

        var response = await factory.ClientFor(grace).PostAsync($"/api/notifications/{ruths}/read", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Null(await ReadAtAsync(ruths));
    }

    // AC3: Given unread notifications, when the user chooses "Mark all as read", then the count clears.
    [Fact]
    public async Task Mark_all_as_read_clears_the_count_for_the_caller_only()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        await AddAsync(grace, "One", Monday);
        await AddAsync(grace, "Two", Monday.AddHours(1));
        await AddAsync(ruth, "Ruth's", Monday);
        var client = factory.ClientFor(grace);

        var response = await client.PostAsync("/api/notifications/read-all", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, (await client.GetFromJsonAsync<CountResponse>("/api/notifications/unread-count"))!.Count);
        Assert.Equal(1, (await factory.ClientFor(ruth).GetFromJsonAsync<CountResponse>("/api/notifications/unread-count"))!.Count);
    }

    // AC4: Given the notifications page, when there are none, then an empty state is shown.
    [Fact]
    public async Task Member_without_notifications_gets_an_empty_page()
    {
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var page = await factory.ClientFor(leah).GetFromJsonAsync<NotificationPageResponse>("/api/notifications");

        Assert.Empty(page!.Items);
        Assert.Equal(0, page.UnreadCount);
        Assert.Equal(0, page.TotalCount);
    }

    private async Task<Guid> AddAsync(ProfileClients.Member member, string title, DateTimeOffset at, bool read = false, string? actor = null) =>
        await factory.WithDbAsync(async db =>
        {
            var notification = new Notification(member.ProfileId, NotificationKind.Announcement, title, "/announcements", at, actor);
            if (read)
            {
                notification.MarkRead(at.AddMinutes(1));
            }

            db.Notifications.Add(notification);
            await db.SaveChangesAsync();
            return notification.Id;
        });

    private Task<DateTimeOffset?> ReadAtAsync(Guid id) =>
        factory.WithDbAsync(db => db.Notifications.Where(n => n.Id == id).Select(n => n.ReadAt).SingleAsync());

    public sealed record NotificationResponse(
        Guid Id, string Kind, string Title, string LinkPath, string? ActorName, DateTimeOffset CreatedAt, DateTimeOffset? ReadAt);

    public sealed record NotificationPageResponse(NotificationResponse[] Items, int UnreadCount, int Page, int PageSize, int TotalCount);

    public sealed record CountResponse(int Count);
}
