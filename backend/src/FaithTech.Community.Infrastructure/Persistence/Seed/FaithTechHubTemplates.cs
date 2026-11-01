using System.Text.Json;
using FaithTech.Community.Domain.Events;

namespace FaithTech.Community.Infrastructure.Persistence.Seed;

/// <summary>
/// FaithTech's hub templates (L2-171 AC2, ADR 0041): seed data, never named in code. Agenda rows hold minutes from the
/// event's start. Fixed ids keep the seed idempotent, so an administrator's edits survive a re-run.
/// </summary>
public static class FaithTechHubTemplates
{
    private sealed record Row(int Minutes, string Title, string? Detail = null);

    private sealed record Template(Guid Id, string Name, string Description, HubSectionKind[] Hidden, string Subtitle, Row[] Agenda, string? Giving);

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    private static readonly Template[] All =
    [
        new(new("9a1c4e2b-6d3f-4b8a-9e10-4c5d6e7f8a01"), "Hackathon", "A day of building in teams, with demos at the end.", [],
            "One day to build for the church. Form a team and ship something real.",
            [
                new(0, "Doors, check-in and breakfast"),
                new(15, "Worship", "Three songs, about 15 minutes."),
                new(30, "Welcome and overview", "Who we are and the plan for the day."),
                new(60, "Form teams", "Go to your track’s corner of the room."),
                new(180, "Lunch"),
                new(210, "Build starts", "Pray, prototype, pause. Repeat."),
                new(420, "Code freeze", "Submit your project to get a demo slot."),
                new(435, "Demos", "Three minutes per team, then two minutes of questions."),
                new(510, "Team honors"),
                new(540, "Next steps and commissioning", "What comes next, then we pray and send."),
            ],
            "Help us build the next one."),
        new(new("9a1c4e2b-6d3f-4b8a-9e10-4c5d6e7f8a02"), "Meetup", "An evening of talks and conversation.", [HubSectionKind.Links],
            "An evening of conversation for Christians who build.",
            [
                new(0, "Doors open", "Grab a drink and find a seat."),
                new(30, "Welcome and prayer"),
                new(45, "Talks"),
                new(90, "Conversation and connection"),
            ],
            "Help us host the next one."),
        new(new("9a1c4e2b-6d3f-4b8a-9e10-4c5d6e7f8a03"), "Workshop", "A hands-on session with one facilitator.",
            [HubSectionKind.Links, HubSectionKind.Giving],
            "Bring your laptop. We’ll learn by doing.",
            [
                new(0, "Welcome and setup", "Get on the wifi and open the starter files."),
                new(15, "Teaching"),
                new(60, "Hands-on time", "Work through the exercises in pairs."),
                new(105, "Share back"),
            ],
            null),
    ];

    public static IReadOnlyList<Guid> Ids => [.. All.Select(t => t.Id)];

    public static IReadOnlyList<HubTemplate> Templates() =>
        [.. All.Select((t, index) => new HubTemplate(t.Id, t.Name, t.Description, index + 1, Sections(t)))];

    private static string Sections(Template t) =>
        JsonSerializer.Serialize(
            Enum.GetValues<HubSectionKind>().Select(kind => new
            {
                kind = kind.ToString(),
                visible = !t.Hidden.Contains(kind),
                content = Content(t, kind),
            }),
            Options);

    private static object? Content(Template t, HubSectionKind kind) => kind switch
    {
        HubSectionKind.Hero => new { subtitle = t.Subtitle },
        HubSectionKind.Agenda => new { items = t.Agenda.Select(r => new { minutes = r.Minutes, title = r.Title, detail = r.Detail }) },
        HubSectionKind.Giving when t.Giving is not null => new { line = t.Giving },
        HubSectionKind.UpcomingEvents => new { count = 3 },
        _ => null,
    };
}
