// Traces to: L2-085, L2-087 (docs/detailed-designs/partners/partner-activity-timeline)
//
// Given a partner, when a lead or System Admin logs a call, email, meeting or note with what
// happened and a date, then it is saved with who logged it and when (UTC) and tops the shared
// timeline. Given a blank or overlong summary, a missing or future date, an overlong next step or
// a due date without a next step, then the API answers 400 keyed by field and saves nothing.
// Given a logged activity, then no route edits or deletes it.
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Partners.PartnerClients;

namespace FaithTech.Community.Api.Tests.Partners;

public class PartnerActivityTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private DateOnly Today => DateOnly.FromDateTime(factory.Time.GetUtcNow().UtcDateTime);

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task A_lead_or_system_admin_logs_an_activity_and_it_is_on_the_shared_timeline(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var loggedAt = factory.Time.GetUtcNow().UtcDateTime;

        var response = await factory.ClientFor(marcus, role).LogActivityAsync(partner.Id, NewActivity(
            "Call", " Called Nadia about the contract. ", Today.ToString("yyyy-MM-dd"), "14:15", "Send credit-line wording", Today.AddDays(1).ToString("yyyy-MM-dd")));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var logged = (await response.Content.ReadFromJsonAsync<Activity>())!;
        Assert.Equal($"/api/partners/{partner.Id}/activities/{logged.Id}", response.Headers.Location?.OriginalString);
        Assert.Equal(
            ("Call", "Called Nadia about the contract.", "Called Nadia about the contract.", Today, (TimeOnly?)new TimeOnly(14, 15), "Send credit-line wording", (DateOnly?)Today.AddDays(1), marcus.ProfileId, "Marcus Lee", loggedAt),
            (logged.Kind, logged.Summary, logged.Text, logged.OccurredOn, logged.OccurredAt, logged.NextStep, logged.NextStepDue, logged.LoggedById, logged.LoggedByName, logged.LoggedAtUtc));
        // Every reader sees the same entry; the system's Added entry may be later today, so read the calls.
        var timeline = await factory.ClientFor(grace, Role.CityLead).ActivitiesAsync(partner.Id, "?kind=Call");
        Assert.Equal(logged, Assert.Single(timeline.Items));
    }

    [Fact]
    public async Task Tomorrow_utc_is_accepted_so_a_lead_east_of_utc_can_log_their_today()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");

        var response = await factory.ClientFor(grace, Role.CityLead)
            .LogActivityAsync(partner.Id, NewActivity("Note", occurredOn: Today.AddDays(1).ToString("yyyy-MM-dd")));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    public static TheoryData<object, string, string> Invalid => new()
    {
        { NewActivity(summary: ""), "Summary", "Say what happened." },
        { NewActivity(summary: "   "), "Summary", "Say what happened." },
        { NewActivity(summary: new string('a', 2001)), "Summary", "Use 2,000 characters or fewer for what happened." },
        { NewActivity(kind: "Lunch"), "Kind", "Choose call, email, meeting or note." },
        { NewActivity(kind: "StageMoved"), "Kind", "Choose call, email, meeting or note." },
        { NewActivity(nextStep: new string('a', 201)), "NextStep", "Use 200 characters or fewer for the next step." },
        { NewActivity(nextStepDue: "2026-10-23"), "NextStepDue", "Add the next step, or clear its due date." },
    };

    [Theory]
    [MemberData(nameof(Invalid))]
    public async Task An_invalid_activity_is_400_keyed_by_field_and_nothing_is_saved(object activity, string field, string message)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var body = WithDate(activity);

        var response = await factory.ClientFor(grace, Role.CityLead).LogActivityAsync(partner.Id, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([message], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
        Assert.Equal(0, await LoggedCountAsync(partner.Id));
    }

    [Fact]
    public async Task A_missing_date_or_one_after_tomorrow_utc_is_400()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var client = factory.ClientFor(grace, Role.CityLead);

        var missing = await client.LogActivityAsync(partner.Id, NewActivity(occurredOn: null));
        var future = await client.LogActivityAsync(partner.Id, NewActivity(occurredOn: Today.AddDays(2).ToString("yyyy-MM-dd")));

        Assert.Equal(["Enter the date it happened."], (await missing.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["OccurredOn"]);
        Assert.Equal(["Choose today or an earlier date."], (await future.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["OccurredOn"]);
        Assert.Equal(0, await LoggedCountAsync(partner.Id));
    }

    [Fact]
    public async Task No_route_edits_or_deletes_a_logged_activity()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var client = factory.ClientFor(grace, Role.CityLead);
        var logged = (await (await client.LogActivityAsync(partner.Id, WithDate(NewActivity()))).Content.ReadFromJsonAsync<Activity>())!;
        var path = $"/api/partners/{partner.Id}/activities/{logged.Id}";

        var put = await client.PutAsJsonAsync(path, WithDate(NewActivity(summary: "Changed")));
        var delete = await client.DeleteAsync(path);

        Assert.Contains(put.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
        Assert.Contains(delete.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
        Assert.Equal(1, await LoggedCountAsync(partner.Id));
    }

    [Fact]
    public async Task Logging_on_an_unknown_partner_is_404()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).LogActivityAsync(Guid.NewGuid(), WithDate(NewActivity()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    /// <summary>Fills in today's date when the case leaves it out, so only the field under test is wrong.</summary>
    private object WithDate(object activity)
    {
        var json = System.Text.Json.JsonSerializer.SerializeToNode(activity)!.AsObject();
        json["OccurredOn"] ??= Today.ToString("yyyy-MM-dd");
        return json;
    }

    private Task<int> LoggedCountAsync(Guid partnerId) =>
        factory.WithDbAsync(db => db.PartnerActivities.CountAsync(a => a.PartnerId == partnerId && PartnerActivityKinds.Logged.Contains(a.Kind)));
}
