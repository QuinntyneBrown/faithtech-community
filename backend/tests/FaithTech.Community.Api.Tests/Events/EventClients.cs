using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

/// <summary>Events stored directly, relative to the factory's clock.</summary>
public static class EventClients
{
    public static async Task<Event> AddEventAsync(
        this CommunityApiFactory factory,
        string title,
        TimeSpan startsIn,
        string? city = "Toronto",
        string type = "gathering",
        EventFormat format = EventFormat.InPerson,
        EventVisibility visibility = EventVisibility.MembersOnly,
        int rsvps = 0,
        string? cancelledBecause = null,
        int? capacity = null,
        Guid? createdBy = null,
        TimeSpan? lasts = null,
        IEnumerable<Guid>? members = null,
        IEnumerable<(string Name, string Email)>? guests = null)
    {
        var chapterId = await factory.ChapterIdAsync(city);
        var eventType = await factory.WithDbAsync(db => db.EventTypeAsync(type));
        var now = factory.Time.GetUtcNow();
        var starts = now + startsIn;
        var created = new Event(
            title,
            $"About {title}.",
            eventType,
            starts,
            starts + (lasts ?? TimeSpan.FromHours(2)),
            chapterId,
            format,
            format == EventFormat.InPerson ? "Kestrel Labs, 220 King St W" : null,
            format == EventFormat.Online ? "https://meet.example.org/ft" : null,
            capacity,
            visibility,
            createdBy ?? Guid.NewGuid());

        // RSVPs can only be taken before the start, so take them "earlier" than any start in the tests, a minute
        // apart so the RSVP order is the order given: anonymous RSVPs, then members, then guests.
        var at = starts.AddDays(-30);
        for (var i = 0; i < rsvps; i++)
        {
            created.Rsvp(Guid.NewGuid(), at = at.AddMinutes(1));
        }

        foreach (var member in members ?? [])
        {
            created.Rsvp(member, at = at.AddMinutes(1));
        }

        foreach (var (name, email) in guests ?? [])
        {
            created.GuestRsvp(name, email, at = at.AddMinutes(1));
        }

        if (cancelledBecause is not null)
        {
            created.Cancel(cancelledBecause);
        }

        await factory.WithDbAsync(async db =>
        {
            db.EventTypes.Attach(eventType);
            db.Events.Add(created);
            return await db.SaveChangesAsync();
        });
        return created;
    }

    /// <summary>The organisation's event type with this key, such as FaithTech's "gathering" (L2-151 AC3).</summary>
    public static Task<FaithTech.Community.Domain.Organisations.EventType> EventTypeAsync(this CommunityDbContext db, string key = "gathering") =>
        db.EventTypes.AsNoTracking().SingleAsync(t => t.Key == key);

    /// <summary>Cancels an event straight in the database, as the cancel handler would.</summary>
    public static Task CancelEventAsync(this CommunityApiFactory factory, Guid id, string reason) =>
        factory.WithDbAsync(async db =>
        {
            (await db.Events.SingleAsync(e => e.Id == id)).Cancel(reason);
            return await db.SaveChangesAsync();
        });

    public static Task<string> EmailOfAsync(this CommunityApiFactory factory, ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync());

    public static Task<Event> LoadEventAsync(this CommunityApiFactory factory, Guid id) =>
        factory.WithDbAsync(db => db.Events.AsNoTracking().Include(e => e.Rsvps).SingleAsync(e => e.Id == id));
}
