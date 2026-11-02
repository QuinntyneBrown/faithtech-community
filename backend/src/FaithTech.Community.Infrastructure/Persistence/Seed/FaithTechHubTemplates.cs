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

    private sealed record Template(
        Guid Id, string Name, string Description, HubSectionKind[] Hidden, string Subtitle, Row[] Agenda, string? Giving,
        bool Hackathon = false);

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
            "Help us build the next one.", Hackathon: true),
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
        [.. All.Select((t, index) => new HubTemplate(t.Id, t.Name, t.Description, index + 1, Sections(t, t.Hackathon)))];

    /// <summary>The template's sections as the first seed wrote them, core kinds only: the one state the seed may upgrade.</summary>
    public static string CoreOnlySections(Guid id) => Sections(All.Single(t => t.Id == id), hackathon: false);

    /// <summary>A hackathon template names every kind, in catalogue order; the others name the core kinds (L2-183 AC1).</summary>
    private static string Sections(Template t, bool hackathon) =>
        JsonSerializer.Serialize(
            Enum.GetValues<HubSectionKind>().Where(kind => hackathon || HubSectionKinds.IsCore(kind)).Select(kind => new
            {
                kind = kind.ToString(),
                visible = !t.Hidden.Contains(kind),
                content = Content(t, kind),
            }),
            Options);

    private static object Stage(string title, string summary, params (string Title, string Detail)[] points) =>
        new { title, summary, points = points.Select(p => new { title = p.Title, detail = p.Detail }) };

    private static object? Content(Template t, HubSectionKind kind) => kind switch
    {
        HubSectionKind.WhatToBring => new
        {
            bring = new[]
            {
                "Your laptop and charger", "Your phone, for testing and demos", "A GitHub account and your username, for your team’s public repo",
                "Logins for the AI and dev tools you like to use",
            },
            onTheDay = new[]
            {
                new { title = "Raise a hand", detail = "Mentors walk the floor every hour. Stuck for 15 minutes? Ask." },
                new { title = "Candid photos", detail = "We’ll be taking photos. Rather not be in them? Tell a host." },
                new { title = "Close the loop", detail = "If you make a commitment, honor it." },
            },
        },
        HubSectionKind.Process => new
        {
            name = "The Create Cycle",
            intro = "Redemptive technology starts before the code. Every team moves through the same four movements.",
            stages = new[]
            {
                Stage("Lament", "We patiently refuse to rush past pain.",
                    ("Listen", "Who does your track serve? Whose pain have you heard?"),
                    ("Remember", "Name the pain honestly. Who’s left out, and why?"),
                    ("Repent", "What in us needs to change?"),
                    ("Rejoice", "Where have you already seen God at work?")),
                Stage("Discern", "We seek God’s wisdom before choosing a response.",
                    ("Ideate", "Get every idea out. No critique yet."),
                    ("Map the path", "Clarify the scope and what you hope to build today."),
                    ("Choose a direction", "Reject, receive, reimagine or create?")),
                Stage("Build", "We faithfully build in dependence on the Spirit.",
                    ("Pray, prototype, pause", "A rhythm, all afternoon. Repeat."),
                    ("Prayer pause", "Is this still what we discerned? Are people being loved well?")),
                Stage("Steward", "We take responsibility for what we release.",
                    ("Tend", "Show it working, live."),
                    ("Examine", "The fruit and the risks."),
                    ("Testify", "What God did in your team.")),
            },
        },
        HubSectionKind.Rules => new
        {
            rules = new[]
            {
                new { title = "Start fresh", detail = "The code starts today." },
                new { title = "Any stack", detail = "Open source, APIs and AI tools welcome." },
                new { title = "Test data only", detail = "No real personal data from churches." },
                new { title = "Credit your sources", detail = "Name the tools and templates you used." },
                new { title = "Code freeze", detail = "Working beats perfect." },
                new { title = "Public repo", detail = "Keeps the code open for others to steward." },
            },
        },
        HubSectionKind.DemoFormat => new
        {
            minutes = 3,
            questionMinutes = 2,
            segments = new[]
            {
                new { title = "Your track", detail = "Who it’s for.", seconds = 30 },
                new { title = "Tend", detail = "Show it working, live.", seconds = 90 },
                new { title = "Examine", detail = "The fruit and the risks.", seconds = 30 },
                new { title = "Testify", detail = "What God did in your team.", seconds = 30 },
            },
            tips = new[] { "Demo on a phone", "Have a backup video", "Start with a person" },
        },
        HubSectionKind.Judging => new
        {
            topScore = 5,
            criteria = new[]
            {
                new
                {
                    title = "Redemptive potential", question = "Could this advance the gospel and reach real people, beyond the demo?",
                    topMark = "Real people could meet, follow or share Jesus through it long after today.", weight = 40,
                },
                new
                {
                    title = "Usable by the end user", question = "Could a pastor, a new believer or a church volunteer use it without us in the room?",
                    topMark = "A pastor or volunteer could pick it up today with no help.", weight = 30,
                },
                new
                {
                    title = "Technical viability", question = "Does it work live, end to end?",
                    topMark = "It runs live, end to end, with nothing faked.", weight = 30,
                },
            },
            honors = new[]
            {
                new { title = "Most Redemptive", line = "Deployable and ready for impact: viable, and built in the way of Jesus.", chosenBy = "TopScore" },
                new { title = "Most Collaborative", line = "Built best together. Every member shaped the work.", chosenBy = "MentorsPick" },
                new { title = "Most Creative", line = "The most imaginative answer to the challenge.", chosenBy = "JudgesPick" },
            },
        },
        HubSectionKind.Hero => new { subtitle = t.Subtitle },
        HubSectionKind.Agenda => new { items = t.Agenda.Select(r => new { minutes = r.Minutes, title = r.Title, detail = r.Detail }) },
        HubSectionKind.Giving when t.Giving is not null => new { line = t.Giving },
        HubSectionKind.UpcomingEvents => new { count = 3 },
        _ => null,
    };
}
