namespace FaithTech.Community.Domain.Events;

/// <summary>
/// The kinds of hub section, in catalogue order (L2-172 AC1). Stored as text, so the order can change without moving data.
/// <see cref="HubSectionKinds.Core"/> are on every hub; the rest are optional and come with a starting point (ADR 0042).
/// </summary>
public enum HubSectionKind
{
    Hero,
    Agenda,
    Venue,
    Parking,
    WhatToBring,
    Partners,
    Tracks,
    Process,
    Rules,
    People,
    Links,
    DemoFormat,
    Judging,
    Worship,
    Slides,
    Giving,
    UpcomingEvents,
}

/// <summary>The core kinds every hub holds (L2-172 AC1, AC2); the others are optional.</summary>
public static class HubSectionKinds
{
    public static readonly IReadOnlyList<HubSectionKind> Core =
    [
        HubSectionKind.Hero, HubSectionKind.Agenda, HubSectionKind.Venue, HubSectionKind.People, HubSectionKind.Links,
        HubSectionKind.Giving, HubSectionKind.UpcomingEvents,
    ];

    public static bool IsCore(HubSectionKind kind) => Core.Contains(kind);
}
