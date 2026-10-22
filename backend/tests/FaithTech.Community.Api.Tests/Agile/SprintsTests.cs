// Traces to: L2-031 AC4, AC7, L2-035
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Domain.Agile;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

public class SprintsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record SprintView(Guid Id, string Name, string Goal, DateOnly StartDate, DateOnly EndDate, string State, int StoryCount, int Points, int? CompletedPoints, int? CommittedPoints);

    public record Candidate(Guid Id, string Title, int? StoryPoints, string Status, string? ReturnedFrom);

    public record Sprints(SprintView? Active, SprintView[] History, int? AverageCompletedPoints, Candidate[] Candidates);

    private static object Start(string name, string goal, Guid[] storyIds, string start = "2026-11-03", string end = "2026-11-14") =>
        new { Name = name, Goal = goal, StartDate = start, EndDate = end, StoryIds = storyIds };

    [Fact]
    public async Task Given_the_owner_when_they_start_a_sprint_with_stories_then_it_becomes_active_with_those_stories()
    {
        var cast = await factory.AddCastAsync();
        var kiosk = await factory.AddStoryAsync(cast.WorkspaceId, "Volunteer check-in kiosk", points: 5);
        var av = await factory.AddStoryAsync(cast.WorkspaceId, "Book AV", points: 2);
        await factory.AddStoryAsync(cast.WorkspaceId, "Not chosen", points: 8);

        var response = await factory.OwnerClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/sprints", Start(" Sprint 8 ", "Hackathon weekend runs smoothly", [kiosk, av]));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var sprints = (await factory.MemberClient(cast).GetFromJsonAsync<Sprints>($"/api/workspaces/{cast.WorkspaceId}/sprints"))!;
        Assert.Equal(("Sprint 8", "Active", 2, 7, new DateOnly(2026, 11, 14)), (sprints.Active!.Name, sprints.Active.State, sprints.Active.StoryCount, sprints.Active.Points, sprints.Active.EndDate));
        Assert.Equal(sprints.Active.Id, (await factory.LoadItemAsync(kiosk)).SprintId);
        // The next sprint can take backlog stories and whatever this sprint leaves unfinished.
        Assert.Equal([("Book AV", "Sprint 8"), ("Not chosen", null), ("Volunteer check-in kiosk", "Sprint 8")],
            sprints.Candidates.Select(c => (c.Title, c.ReturnedFrom)));
    }

    [Fact]
    public async Task Given_an_active_sprint_when_the_owner_starts_the_next_then_the_active_one_closes_first_and_no_two_are_active()
    {
        var cast = await factory.AddCastAsync();
        var first = await factory.AddSprintAsync(cast.WorkspaceId, "Sprint 7");
        var done = await factory.AddStoryAsync(cast.WorkspaceId, "Registration page", WorkItemStatus.Done, 6, first);
        var unfinished = await factory.AddStoryAsync(cast.WorkspaceId, "Shelter briefs", WorkItemStatus.InProgress, 8, first);

        var candidates = (await factory.OwnerClient(cast).GetFromJsonAsync<Sprints>($"/api/workspaces/{cast.WorkspaceId}/sprints"))!.Candidates;
        var response = await factory.OwnerClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/sprints", Start("Sprint 8", "Hackathon weekend", [unfinished]));

        Assert.Equal(("Shelter briefs", "Sprint 7"), (Assert.Single(candidates).Title, candidates[0].ReturnedFrom));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var sprints = await factory.WithDbAsync(db => db.Sprints.AsNoTracking().Where(s => s.WorkspaceId == cast.WorkspaceId).ToListAsync());
        Assert.Single(sprints, s => s.State == SprintState.Active);
        var closed = sprints.Single(s => s.Id == first);
        Assert.Equal((SprintState.Closed, (int?)6, (int?)14), (closed.State, closed.CompletedPoints, closed.CommittedPoints));
        Assert.Equal(first, (await factory.LoadItemAsync(done)).SprintId);
        Assert.NotEqual(first, (await factory.LoadItemAsync(unfinished)).SprintId);
    }

    [Theory]
    [InlineData("", "Goal", "Write a goal so the team knows what done looks like.")]
    [InlineData("end", "EndDate", "Choose an end date after the start date.")]
    [InlineData("none", "StoryIds", "Choose at least one story.")]
    public async Task Given_a_missing_goal_an_end_before_the_start_or_no_story_when_starting_then_400(string problem, string field, string message)
    {
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk", points: 5);
        var body = problem switch
        {
            "" => Start("Sprint 8", " ", [story]),
            "end" => Start("Sprint 8", "Goal", [story], "2026-11-14", "2026-11-03"),
            _ => Start("Sprint 8", "Goal", []),
        };

        var response = await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/sprints", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([message], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
    }

    [Fact]
    public async Task Given_a_kanban_workspace_when_the_owner_starts_a_sprint_then_409()
    {
        var cast = await factory.AddCastAsync(WorkspaceMethod.Kanban);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");

        var response = await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/sprints", Start("Sprint 1", "Goal", [story]));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("member", HttpStatusCode.Forbidden)]
    [InlineData("staff", HttpStatusCode.Forbidden)]
    [InlineData("outsider", HttpStatusCode.NotFound)]
    public async Task Given_anyone_but_the_owner_or_admin_when_they_start_or_close_a_sprint_then_refused(string who, HttpStatusCode expected)
    {
        var cast = await factory.AddCastAsync();
        var active = await factory.AddSprintAsync(cast.WorkspaceId);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");
        var client = who switch
        {
            "member" => factory.MemberClient(cast),
            "staff" => factory.StaffClient(cast),
            _ => factory.OutsiderClient(cast),
        };

        var start = await client.PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/sprints", Start("Sprint 8", "Goal", [story]));
        var close = await client.PostAsync($"/api/workspaces/{cast.WorkspaceId}/sprints/{active}/close", null);

        Assert.Equal((expected, expected), (start.StatusCode, close.StatusCode));
    }

    [Fact]
    public async Task Given_a_member_when_they_move_stories_into_the_active_sprint_then_they_appear_in_it()
    {
        var cast = await factory.AddCastAsync();
        var active = await factory.AddSprintAsync(cast.WorkspaceId);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Hackathon photo release form", points: 2);

        var response = await factory.MemberClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/sprints/{active}/stories", new { StoryIds = new[] { story } });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(active, (await factory.LoadItemAsync(story)).SprintId);
    }

    [Fact]
    public async Task Given_staff_when_they_move_stories_into_a_sprint_then_403()
    {
        var cast = await factory.AddCastAsync();
        var active = await factory.AddSprintAsync(cast.WorkspaceId);
        var story = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk");

        var response = await factory.StaffClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/sprints/{active}/stories", new { StoryIds = new[] { story } });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Given_the_owner_closes_the_active_sprint_then_unfinished_stories_return_to_the_backlog_and_completed_points_are_recorded()
    {
        var cast = await factory.AddCastAsync();
        var active = await factory.AddSprintAsync(cast.WorkspaceId);
        var done = await factory.AddStoryAsync(cast.WorkspaceId, "Registration page", WorkItemStatus.Done, 6, active);
        var todo = await factory.AddStoryAsync(cast.WorkspaceId, "Kiosk", WorkItemStatus.ToDo, 5, active);
        var started = await factory.AddStoryAsync(cast.WorkspaceId, "Briefs", WorkItemStatus.InProgress, 13, active);

        var response = await factory.OwnerClient(cast).PostAsync($"/api/workspaces/{cast.WorkspaceId}/sprints/{active}/close", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal((null, null, (Guid?)active), ((await factory.LoadItemAsync(todo)).SprintId, (await factory.LoadItemAsync(started)).SprintId, (await factory.LoadItemAsync(done)).SprintId));
        Assert.Equal(WorkItemStatus.InProgress, (await factory.LoadItemAsync(started)).Status);
        var sprints = (await factory.OwnerClient(cast).GetFromJsonAsync<Sprints>($"/api/workspaces/{cast.WorkspaceId}/sprints"))!;
        Assert.Null(sprints.Active);
        var closed = Assert.Single(sprints.History);
        Assert.Equal((6, 24), (closed.CompletedPoints, closed.CommittedPoints));
    }

    [Fact]
    public async Task Given_closed_sprints_when_the_history_is_viewed_then_each_shows_goal_dates_and_points_with_the_average()
    {
        var cast = await factory.AddCastAsync();
        foreach (var (name, done, open, start) in new[] { ("Sprint 4", 24, 0, new DateOnly(2026, 9, 8)), ("Sprint 5", 18, 8, new DateOnly(2026, 9, 22)), ("Sprint 6", 21, 2, new DateOnly(2026, 10, 6)) })
        {
            var sprint = await factory.AddSprintAsync(cast.WorkspaceId, name, SprintState.Active, start: start, end: start.AddDays(11));
            await factory.AddStoryAsync(cast.WorkspaceId, $"{name} done", WorkItemStatus.Done, done, sprint);
            if (open > 0)
            {
                await factory.AddStoryAsync(cast.WorkspaceId, $"{name} open", WorkItemStatus.ToDo, open, sprint);
            }

            await factory.OwnerClient(cast).PostAsync($"/api/workspaces/{cast.WorkspaceId}/sprints/{sprint}/close", null);
        }

        var sprints = (await factory.StaffClient(cast).GetFromJsonAsync<Sprints>($"/api/workspaces/{cast.WorkspaceId}/sprints"))!;

        Assert.Equal(["Sprint 6", "Sprint 5", "Sprint 4"], sprints.History.Select(s => s.Name));
        Assert.Equal((21, 23, "Hackathon ready for registration"), (sprints.History[0].CompletedPoints!.Value, sprints.History[0].CommittedPoints!.Value, sprints.History[0].Goal));
        Assert.Equal(21, sprints.AverageCompletedPoints);
    }

    [Fact]
    public async Task Given_a_system_admin_when_they_close_a_sprint_then_it_is_audited()
    {
        var cast = await factory.AddCastAsync();
        var active = await factory.AddSprintAsync(cast.WorkspaceId);

        await factory.AdminClient(cast).PostAsync($"/api/workspaces/{cast.WorkspaceId}/sprints/{active}/close", null);

        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == active.ToString()));
        Assert.Equal(("sprint.closed", cast.Admin.ProfileId), (entry.Action, entry.ActorId));
    }

    [Fact]
    public async Task Given_an_outsider_when_they_request_sprints_then_404()
    {
        var cast = await factory.AddCastAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await factory.OutsiderClient(cast).GetAsync($"/api/workspaces/{cast.WorkspaceId}/sprints")).StatusCode);
    }
}
