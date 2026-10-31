namespace FaithTech.Community.Domain.Organisations;

/// <summary>
/// The platform's capability catalogue (ADR 0033, L2-135 AC1): the named rights an organisation's roles may carry. An
/// organisation chooses which roles carry them and never adds, renames or removes one; adding an entry is a code change.
/// </summary>
public static class Capability
{
    public const string ManageEvents = nameof(ManageEvents);
    public const string ViewAttendees = nameof(ViewAttendees);
    public const string ManageAttendance = nameof(ManageAttendance);
    public const string KeepContacts = nameof(KeepContacts);
    public const string ViewPartners = nameof(ViewPartners);
    public const string ManagePartners = nameof(ManagePartners);
    public const string InviteMembers = nameof(InviteMembers);
    public const string ConnectLink = nameof(ConnectLink);
    public const string OwnWorkspaces = nameof(OwnWorkspaces);
    public const string JoinWorkspaces = nameof(JoinWorkspaces);
    public const string ReadAllWorkspaces = nameof(ReadAllWorkspaces);
    public const string ViewPeopleDirectory = nameof(ViewPeopleDirectory);
    public const string AssignRoles = nameof(AssignRoles);
    public const string SendAnnouncements = nameof(SendAnnouncements);
    public const string AddResources = nameof(AddResources);
    public const string ViewReports = nameof(ViewReports);
    public const string ManageRoles = nameof(ManageRoles);
    public const string ManageOrganisationSettings = nameof(ManageOrganisationSettings);
    public const string AdministerOrganisation = nameof(AdministerOrganisation);

    /// <summary>Every capability in catalogue order, with its one-line description.</summary>
    public static IReadOnlyList<(string Key, string Description)> All { get; } =
    [
        (ManageEvents, "Create, edit and cancel events."),
        (ViewAttendees, "See who has RSVP'd to events and who checked in."),
        (ManageAttendance, "Check people in, add walk-ins, see guest emails and export RSVPs."),
        (KeepContacts, "Keep private contacts and notes about people met."),
        (ViewPartners, "See the partner pipeline."),
        (ManagePartners, "Add, edit, move and merge partners."),
        (InviteMembers, "Invite people to join the organisation."),
        (ConnectLink, "Have a reusable QR code that adds people met as contacts."),
        (OwnWorkspaces, "Create and own agile workspaces."),
        (JoinWorkspaces, "Be added as a member of agile workspaces."),
        (ReadAllWorkspaces, "Read every agile workspace without being a member."),
        (ViewPeopleDirectory, "See the full people directory, with emails."),
        (AssignRoles, "Grant and remove the roles the grant rules allow."),
        (SendAnnouncements, "Compose and send announcements."),
        (AddResources, "Add resources and share them."),
        (ViewReports, "See the Reports page and export its figures."),
        (ManageRoles, "Define, edit and archive roles and their grant rules."),
        (ManageOrganisationSettings, "Edit the organisation's name, chapters, stages and types."),
        (AdministerOrganisation, "Do anything in the organisation; every override is audited."),
    ];

    private static readonly HashSet<string> Known = All.Select(c => c.Key).ToHashSet(StringComparer.Ordinal);

    /// <summary>Whether <paramref name="capability"/> is in the catalogue, exactly as spelled.</summary>
    public static bool IsKnown(string capability) => Known.Contains(capability);
}
