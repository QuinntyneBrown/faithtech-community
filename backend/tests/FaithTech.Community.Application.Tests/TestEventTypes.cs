using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Tests;

/// <summary>Event types arranged as FaithTech's seed defines them (L2-151 AC3).</summary>
public static class TestEventTypes
{
    public static readonly EventType Gathering = new(Guid.NewGuid(), "gathering", "Gathering", 1);
    public static readonly EventType BuildersNight = new(Guid.NewGuid(), "builders-night", "Builders night", 2);
    public static readonly EventType Hackathon = new(Guid.NewGuid(), "hackathon", "Hackathon", 3);
    public static readonly EventType PrayerAndPlanning = new(Guid.NewGuid(), "prayer-and-planning", "Prayer & planning", 4);
    public static readonly EventType Panel = new(Guid.NewGuid(), "panel", "Panel", 5);
}
