// Traces to: L2-027
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Notifications;

public class InAppNotificationsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record NotificationItem(
        Guid Id, string Kind, string Title, string LinkPath, DateTimeOffset CreatedAt, DateTimeOffset? ReadAt, Guid? ActorId, string? ActorName);

    public sealed record NotificationPage(
        NotificationItem[] Items, int Page, int PageSize, int TotalCount, int UnreadCount, bool HasMore);

    public sealed record UnreadCount(int Count);

    [Fact]
    public async Task A_member_sees_only_their_own_notifications_newest_first_with_the_unread_count()
    {
        // Given notifications for Grace and one for someone else
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var other = await factory.AddMemberAsync("Marcus Lee");
        var start = factory.Time.GetUtcNow();
        await AddAsync(grace, "Older", start.AddMinutes(-10));
        await AddAsync(grace, "Newer", start.AddMinutes(-1), actor: other);
        await AddAsync(other, "Not Grace's", start);

        // When Grace lists them
        var page = await ListAsync(factory.ClientFor(grace));

        // Then she sees hers, newest first, both unread, with who raised them
        Assert.Equal(["Newer", "Older"], page.Items.Select(n => n.Title));
        Assert.Equal((2, 2, false), (page.UnreadCount, page.TotalCount, page.HasMore));
        Assert.Equal((other.ProfileId, "Marcus Lee"), (page.Items[0].ActorId, page.Items[0].ActorName));
        Assert.Null(page.Items[1].ActorName);
        Assert.Equal(new UnreadCount(2), await factory.ClientFor(grace).GetFromJsonAsync<UnreadCount>("/api/notifications/unread-count"));
    }

    [Fact]
    public async Task Opening_a_notification_marks_it_read_and_keeps_its_link()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var id = await AddAsync(grace, "Tomás Ortega just joined FaithTech", factory.Time.GetUtcNow(), "/contacts/42");
        var client = factory.ClientFor(grace);

        var response = await client.PostAsync($"/api/notifications/{id}/read", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var item = Assert.Single((await ListAsync(client)).Items);
        Assert.Equal("/contacts/42", item.LinkPath);
        Assert.NotNull(item.ReadAt);
        Assert.Equal(0, (await client.GetFromJsonAsync<UnreadCount>("/api/notifications/unread-count"))!.Count);
    }

    [Fact]
    public async Task Another_members_notification_cannot_be_marked_read()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var id = await AddAsync(marcus, "For Marcus", factory.Time.GetUtcNow());

        var response = await factory.ClientFor(grace).PostAsync($"/api/notifications/{id}/read", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Null(await factory.WithDbAsync(db => db.Notifications.Where(n => n.Id == id).Select(n => n.ReadAt).SingleAsync()));
    }

    [Fact]
    public async Task Mark_all_as_read_clears_the_count_and_leaves_other_members_alone()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var now = factory.Time.GetUtcNow();
        await AddAsync(grace, "One", now);
        await AddAsync(grace, "Two", now);
        var his = await AddAsync(marcus, "His", now);
        var client = factory.ClientFor(grace);

        var response = await client.PostAsync("/api/notifications/read-all", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, (await client.GetFromJsonAsync<UnreadCount>("/api/notifications/unread-count"))!.Count);
        Assert.All((await ListAsync(client)).Items, n => Assert.NotNull(n.ReadAt));
        Assert.Null(await factory.WithDbAsync(db => db.Notifications.Where(n => n.Id == his).Select(n => n.ReadAt).SingleAsync()));
    }

    [Fact]
    public async Task A_member_with_none_gets_an_empty_list()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var page = await ListAsync(factory.ClientFor(grace));

        Assert.Empty(page.Items);
        Assert.Equal((0, 0, false), (page.TotalCount, page.UnreadCount, page.HasMore));
    }

    [Fact]
    public async Task Unread_lists_only_unread_notifications()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var now = factory.Time.GetUtcNow();
        var read = await AddAsync(grace, "Read", now.AddMinutes(-2));
        await AddAsync(grace, "Unread", now.AddMinutes(-1));
        var client = factory.ClientFor(grace);
        await client.PostAsync($"/api/notifications/{read}/read", null);

        var unread = await ListAsync(client, "?unreadOnly=true");
        var all = await ListAsync(client);

        Assert.Equal(["Unread"], unread.Items.Select(n => n.Title));
        Assert.Equal(["Unread", "Read"], all.Items.Select(n => n.Title));
    }

    [Fact]
    public async Task More_than_fifty_are_listed_fifty_at_a_time_newest_first()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var start = factory.Time.GetUtcNow();
        await factory.WithDbAsync(async db =>
        {
            for (var i = 0; i < 53; i++)
            {
                db.Notifications.Add(new Notification(grace.ProfileId, NotificationKind.RoleChanged, $"N{i:00}", "/people/me", start.AddMinutes(i)));
            }

            return await db.SaveChangesAsync();
        });
        var client = factory.ClientFor(grace);

        var first = await ListAsync(client);
        var second = await ListAsync(client, "?page=2");

        Assert.Equal((50, "N52", true, 53), (first.Items.Length, first.Items[0].Title, first.HasMore, first.TotalCount));
        Assert.Equal(["N02", "N01", "N00"], second.Items.Select(n => n.Title));
        Assert.False(second.HasMore);
    }

    private static async Task<NotificationPage> ListAsync(HttpClient client, string query = "") =>
        (await client.GetFromJsonAsync<NotificationPage>($"/api/notifications{query}"))!;

    private Task<Guid> AddAsync(
        ProfileClients.Member recipient, string title, DateTimeOffset at, string link = "/people/me", ProfileClients.Member? actor = null) =>
        factory.WithDbAsync(async db =>
        {
            var notification = new Notification(recipient.ProfileId, NotificationKind.RoleChanged, title, link, at, actor?.ProfileId);
            db.Notifications.Add(notification);
            await db.SaveChangesAsync();
            return notification.Id;
        });
}
