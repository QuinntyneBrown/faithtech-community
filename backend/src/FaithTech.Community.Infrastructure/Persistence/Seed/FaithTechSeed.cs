using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Infrastructure.Persistence.Seed;

/// <summary>
/// The FaithTech organisation and the records the seed gives it, with fixed ids so that the migrations and the seeder
/// agree (docs/detailed-designs/organisations/seed-faithtech, L2-151). The only place FaithTech's names appear.
/// </summary>
public static class FaithTechSeed
{
    public static readonly Guid OrganisationId = new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b6c01");

    public const string Slug = "faithtech";

    public const string Host = "app.faithtech.community";

    public const string Name = "FaithTech Community";

    public const string ShortName = "FaithTech";

    public const string ChapterLabelSingular = "City";

    public const string ChapterLabelPlural = "Cities";

    /// <summary>The creation time the first migration records for the row.</summary>
    public static readonly DateTime CreatedAtUtc = new(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);

    /// <summary>A seeded role: its fixed id, the key the migrations map former role values to, and its settings.</summary>
    public sealed record SeedRole(
        Guid Id, string Key, string Name, string Description, string[] Capabilities, bool ShowOnTeam, bool ChapterScopable,
        bool IsOversight, string[] Grants);

    private static readonly string[] CreateLeadCapabilities =
    [
        Capability.ViewAttendees, Capability.ManageAttendance, Capability.KeepContacts, Capability.ViewPartners,
        Capability.ManagePartners, Capability.InviteMembers, Capability.JoinWorkspaces, Capability.AddResources,
    ];

    /// <summary>
    /// FaithTech's nine roles in display order, described as the web app's role list describes them (L2-151 AC2). Each key
    /// is the former role value, so the migrations map a former value to the definition of the same name and the role
    /// names the API returns stay the same until the app reads definitions (slice 12).
    /// </summary>
    public static readonly IReadOnlyList<SeedRole> Roles =
    [
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7001"), "CityLead", "City Lead", "Leads a city team and manages its roles",
            [
                Capability.ManageEvents, Capability.ManageEventHubs, Capability.ViewAttendees, Capability.ManageAttendance,
                Capability.KeepContacts, Capability.ViewPartners, Capability.ManagePartners, Capability.InviteMembers, Capability.ConnectLink,
                Capability.OwnWorkspaces, Capability.JoinWorkspaces, Capability.ViewPeopleDirectory, Capability.AssignRoles,
                Capability.AddResources,
            ],
            ShowOnTeam: true, ChapterScopable: true, IsOversight: false,
            Grants: ["EventLead", "CreateLead", "CommunicationsLead", "Volunteer", "ProductEngineer", "Attendee"]),
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7002"), "EventLead", "Event Lead", "Creates and manages events",
            [
                Capability.ManageEvents, Capability.ManageEventHubs, Capability.ViewAttendees, Capability.ManageAttendance,
                Capability.KeepContacts, Capability.ViewPartners, Capability.ManagePartners, Capability.InviteMembers, Capability.JoinWorkspaces,
                Capability.AddResources,
            ],
            ShowOnTeam: true, ChapterScopable: true, IsOversight: false, Grants: []),
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7003"), "CreateLead", "Create Lead", "Runs hackathon builders and projects",
            CreateLeadCapabilities, ShowOnTeam: true, ChapterScopable: true, IsOversight: false, Grants: []),
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7004"), "CommunicationsLead", "Communications Lead", "Sends announcements",
            [.. CreateLeadCapabilities, Capability.SendAnnouncements],
            ShowOnTeam: true, ChapterScopable: true, IsOversight: false, Grants: []),
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7005"), "Staff", "Staff", "Read-only oversight across FaithTech",
            [
                Capability.ViewAttendees, Capability.ViewPartners, Capability.ReadAllWorkspaces, Capability.ViewPeopleDirectory,
                Capability.ViewReports, Capability.AddResources,
            ],
            ShowOnTeam: false, ChapterScopable: false, IsOversight: true, Grants: []),
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7006"), "Volunteer", "Volunteer", "Joins the city team",
            [Capability.JoinWorkspaces], ShowOnTeam: true, ChapterScopable: true, IsOversight: false, Grants: []),
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7007"), "ProductEngineer", "Product Engineer", "Builds at hackathons",
            [], ShowOnTeam: false, ChapterScopable: false, IsOversight: false, Grants: []),
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7008"), "Attendee", "Attendee", "Comes to events",
            [], ShowOnTeam: false, ChapterScopable: false, IsOversight: false, Grants: []),
        new(new("0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7009"), "SystemAdmin", "System Admin", "Full administration and the audit log",
            [Capability.AdministerOrganisation], ShowOnTeam: false, ChapterScopable: false, IsOversight: false, Grants: []),
    ];

    /// <summary>The seeded roles as definitions, with City Lead's grant rules.</summary>
    public static IReadOnlyList<RoleDefinition> RoleDefinitions()
    {
        var ids = Roles.ToDictionary(r => r.Key, r => r.Id);
        return
        [
            .. Roles.Select((role, index) =>
            {
                var definition = new RoleDefinition(role.Id, role.Key, role.Name, role.Description, role.Capabilities, index);
                definition.SetFlags(role.ShowOnTeam, role.ChapterScopable, role.IsOversight);
                definition.SetGrantableRoles(role.Grants.Select(key => ids[key]));
                return definition;
            }),
        ];
    }

    /// <summary>A seeded partner stage: its fixed id, the key the migration maps the former stage value to, and its settings.</summary>
    public sealed record SeedStage(Guid Id, string Key, string Name, bool IsInitial, PartnerStageKind Kind);

    /// <summary>
    /// FaithTech's partner stages in order (L2-151 AC3). The keys are what the TaxonomiesFromEnumerations migration maps
    /// the former Lead, InFunnel and Confirmed values to.
    /// </summary>
    public static readonly IReadOnlyList<SeedStage> Stages =
    [
        new(new("5b8e0f3a-7c1d-4a2e-9f60-1a2b3c4d5e01"), "lead", "Lead", IsInitial: true, PartnerStageKind.Open),
        new(new("5b8e0f3a-7c1d-4a2e-9f60-1a2b3c4d5e02"), "in-funnel", "In Funnel", IsInitial: false, PartnerStageKind.Open),
        new(new("5b8e0f3a-7c1d-4a2e-9f60-1a2b3c4d5e03"), "confirmed", "Confirmed", IsInitial: false, PartnerStageKind.Confirmed),
    ];

    public static IReadOnlyList<PartnerStage> PartnerStages() =>
        [.. Stages.Select((s, index) => new PartnerStage(s.Id, s.Key, s.Name, index + 1, s.IsInitial, s.Kind))];

    /// <summary>A seeded event type: its fixed id and the key the migration maps the former type value to.</summary>
    public sealed record SeedEventType(Guid Id, string Key, string Name);

    /// <summary>
    /// FaithTech's event types in order (L2-151 AC3). The keys are what the TaxonomiesFromEnumerations migration maps the
    /// former Gathering, BuildersNight, Hackathon, PrayerAndPlanning and Panel values to.
    /// </summary>
    public static readonly IReadOnlyList<SeedEventType> Types =
    [
        new(new("5b8e0f3a-7c1d-4a2e-9f60-1a2b3c4d5e11"), "gathering", "Gathering"),
        new(new("5b8e0f3a-7c1d-4a2e-9f60-1a2b3c4d5e12"), "builders-night", "Builders night"),
        new(new("5b8e0f3a-7c1d-4a2e-9f60-1a2b3c4d5e13"), "hackathon", "Hackathon"),
        new(new("5b8e0f3a-7c1d-4a2e-9f60-1a2b3c4d5e14"), "prayer-and-planning", "Prayer & planning"),
        new(new("5b8e0f3a-7c1d-4a2e-9f60-1a2b3c4d5e15"), "panel", "Panel"),
    ];

    public static IReadOnlyList<EventType> EventTypes() =>
        [.. Types.Select((t, index) => new EventType(t.Id, t.Key, t.Name, index + 1))];

    /// <summary>A seeded resource type: its fixed id, the key the upload guess maps to, and the former value's name.</summary>
    public sealed record SeedResourceType(Guid Id, string Key, string Name, string FormerValue);

    /// <summary>
    /// FaithTech's resource types in order (L2-151 AC3). The keys are what the ResourceTypesFromEnumeration migration maps
    /// the former values to and what <c>ResourceFileTypes.GuessType</c> answers; <c>other</c> is the fallback.
    /// </summary>
    public static readonly IReadOnlyList<SeedResourceType> ResourceKinds =
    [
        new(new("7c2a4e1b-9d3f-4b6a-8e10-2b3c4d5e6f21"), "deck", "Deck", "Deck"),
        new(new("7c2a4e1b-9d3f-4b6a-8e10-2b3c4d5e6f22"), "logo", "Logo", "Logo"),
        new(new("7c2a4e1b-9d3f-4b6a-8e10-2b3c4d5e6f23"), "image", "Image", "Image"),
        new(new("7c2a4e1b-9d3f-4b6a-8e10-2b3c4d5e6f24"), "training", "Training", "Training"),
        new(new("7c2a4e1b-9d3f-4b6a-8e10-2b3c4d5e6f25"), "template", "Template", "Template"),
        new(new("7c2a4e1b-9d3f-4b6a-8e10-2b3c4d5e6f26"), "document", "Document", "Document"),
        new(new("7c2a4e1b-9d3f-4b6a-8e10-2b3c4d5e6f27"), ResourceType.OtherKey, "Other", "Other"),
    ];

    public static IReadOnlyList<ResourceType> ResourceTypes() =>
        [.. ResourceKinds.Select((t, index) => new ResourceType(t.Id, t.Key, t.Name, index + 1))];

    public static Organisation Organisation()
    {
        var organisation = new Organisation(OrganisationId, Slug, Host, Name, ShortName, CreatedAtUtc);
        organisation.SetChapterLabel(ChapterLabelSingular, ChapterLabelPlural);
        return organisation;
    }
}
