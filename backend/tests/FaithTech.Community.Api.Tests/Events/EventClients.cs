using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

/// <summary>Events stored directly, relative to the factory's clock.</summary>
public static class EventClients
{
    public static async Task<Event> AddEventAsync(
        this CommunityApiFactory factory,
        string title,
        TimeSpan startsIn,
        string city = "Toronto",
        EventType type = EventType.Gathering,
        EventFormat format = EventFormat.InPerson,
        EventVisibility visibility = EventVisibility.MembersOnly,
        int rsvps = 0,
        string? cancelledBecause = null,
        int? capacity = null,
        Guid? createdBy = null,
        TimeSpan? lasts = null)
    {
        var now = factory.Time.GetUtcNow();
        var starts = now + startsIn;
        var created = new Event(
            title,
            $"About {title}.",
            type,
            starts,
            starts + (lasts ?? TimeSpan.FromHours(2)),
            city,
            format,
            format == EventFormat.InPerson ? "Kestrel Labs, 220 King St W" : null,
            format == EventFormat.Online ? "https://meet.example.org/ft" : null,
            capacity,
            visibility,
            createdBy ?? Guid.NewGuid());

        // RSVPs can only be taken before the start, so take them "earlier" than any start in the tests.
        for (var i = 0; i < rsvps; i++)
        {
            created.Rsvp(Guid.NewGuid(), starts.AddDays(-30));
        }

        if (cancelledBecause is not null)
        {
            created.Cancel(cancelledBecause);
        }

        await factory.WithDbAsync(async db =>
        {
            db.Events.Add(created);
            return await db.SaveChangesAsync();
        });
        return created;
    }

    public static Task<Event> LoadEventAsync(this CommunityApiFactory factory, Guid id) =>
        factory.WithDbAsync(db => db.Events.AsNoTracking().Include(e => e.Rsvps).SingleAsync(e => e.Id == id));
}
