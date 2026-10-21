// Traces to: L2-031 AC3, AC5, AC6, L2-032, L2-033
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Agile;

public class WorkItemsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record Ref(Guid Id, string Kind, string Title);

    public record TaskDto(Guid Id, string Title, bool IsDone, Guid? AssigneeId, string? AssigneeName);

    public record CommentDto(Guid Id, Guid AuthorId, string AuthorName, string Body, DateTimeOffset CreatedAt);

    public record Item(
        Guid Id, Guid WorkspaceId, string WorkspaceName, string Kind, string Title, string Description, string Status,
        bool IsDone, Guid? AssigneeId, string? AssigneeName, int? StoryPoints, Ref? Parent, Ref? Grandparent,
        TaskDto[] Tasks, CommentDto[] Comments, bool CanEdit, bool CanManage);

    public record Node(Guid Id, string Kind, string Title, string Status, bool IsDone, int? StoryPoints, string? AssigneeName, Node[] Children);

    private static object New(string kind, string title, Guid? parentId = null, Guid? assigneeId = null, int? storyPoints = null, string description = "") =>
        new { Kind = kind, Title = title, Description = description, ParentId = parentId, AssigneeId = assigneeId, StoryPoints = storyPoints };

    private static async Task<Item> CreatedAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<Item>())!;
    }

    [Fact]
    public async Task Given_the_owner_when_they_build_the_hierarchy_then_epics_sit_under_initiatives_stories_under_epics_and_tasks_under_stories()
    {
        var cast = await factory.AddCastAsync();
        var owner = factory.OwnerClient(cast);
        var items = $"/api/workspaces/{cast.WorkspaceId}/items";

        var initiative = await CreatedAsync(await owner.PostAsJsonAsync(items, New("Initiative", "Launch the hackathon season")));
        var epic = await CreatedAsync(await owner.PostAsJsonAsync(items, New("Epic", "Tech for Shelters hackathon", initiative.Id)));
        var story = await CreatedAsync(await owner.PostAsJsonAsync(items, New("Story", "Shelter problem briefs", epic.Id, storyPoints: 8)));
        var task = await CreatedAsync(await owner.PostAsJsonAsync(items, New("Task", "Interview Harbour Light staff", story.Id)));

        Assert.Equal((epic.Id, "Epic", initiative.Id), (story.Parent!.Id, story.Parent.Kind, story.Grandparent!.Id));
        Assert.Equal((story.Id, false), (task.Parent!.Id, task.IsDone));
        Assert.Equal(8, story.StoryPoints);
    }

    [Theory]
    [InlineData("Story", "Initiative", "A story sits only under an epic.")]
    [InlineData("Epic", "Story", "An epic sits only under an initiative.")]
    [InlineData("Task", "Epic", "A task must belong to a story.")]
    [InlineData("Initiative", "Initiative", "An initiative has no parent.")]
    public async Task Given_a_parent_of_the_wrong_kind_when_an_item_is_created_then_400_on_the_parent(string kind, string parentKind, string message)
    {
        var cast = await factory.AddCastAsync();
        var owner = factory.OwnerClient(cast);
        var items = $"/api/workspaces/{cast.WorkspaceId}/items";
        var parent = await CreatedAsync(await owner.PostAsJsonAsync(items, New(parentKind, "Parent", parentKind switch
        {
            "Story" => (await CreatedAsync(await owner.PostAsJsonAsync(items, New("Epic", "Epic")))).Id,
            _ => null,
        })));

        var response = await owner.PostAsJsonAsync(items, New(kind, "Child", parent.Id));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([message], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["ParentId"]);
    }

    [Theory]
    [InlineData("Initiative")]
    [InlineData("Epic")]
    [InlineData("Story")]
    public async Task Given_an_initiative_epic_or_story_when_created_then_the_parent_is_optional(string kind)
    {
        var cast = await factory.AddCastAsync();

        var item = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New(kind, "No parent")));

        Assert.Null(item.Parent);
    }

    [Fact]
    public async Task Given_a_task_without_a_story_when_created_then_400()
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.MemberClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Task", "Orphan"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["A task must belong to a story."], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["ParentId"]);
    }

    [Fact]
    public async Task Given_a_parent_in_another_workspace_when_an_item_is_created_then_400()
    {
        var cast = await factory.AddCastAsync();
        var other = await factory.AddWorkspaceAsync(cast.Owner, "Other");
        var epic = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{other}/items", New("Epic", "Elsewhere")));

        var response = await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Mine", epic.Id));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("", "Title")]
    [InlineData("201", "Title")]
    [InlineData("Ok", "Kind")]
    public async Task Given_a_missing_or_long_title_or_an_unknown_kind_when_created_then_400_per_field(string title, string field)
    {
        var cast = await factory.AddCastAsync();
        var body = new { Kind = field == "Kind" ? "Bug" : "Story", Title = title == "201" ? new string('x', 201) : title, Description = "" };

        var response = await factory.MemberClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.ContainsKey(field));
    }

    [Theory]
    [InlineData("Initiative")]
    [InlineData("Epic")]
    public async Task Given_a_member_who_is_not_the_owner_when_they_create_an_initiative_or_epic_then_403(string kind)
    {
        var cast = await factory.AddCastAsync();

        var response = await factory.MemberClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New(kind, "Not mine to plan"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Given_a_member_when_they_create_and_edit_stories_and_tasks_then_it_succeeds()
    {
        var cast = await factory.AddCastAsync();
        var member = factory.MemberClient(cast);
        var story = await CreatedAsync(await member.PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Volunteer check-in kiosk")));
        var task = await CreatedAsync(await member.PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Task", "Buy tablets", story.Id)));

        var edit = await member.PutAsJsonAsync($"/api/items/{story.Id}", new
        {
            Title = "Volunteer check-in kiosk v2",
            Description = "As a volunteer, I want to check people in on a tablet.",
            AssigneeId = cast.Member.ProfileId,
            StoryPoints = 5,
            Status = "InProgress",
        });
        var done = await member.PutAsJsonAsync($"/api/items/{task.Id}/done", new { Done = true });

        Assert.Equal((HttpStatusCode.NoContent, HttpStatusCode.NoContent), (edit.StatusCode, done.StatusCode));
        var read = (await member.GetFromJsonAsync<Item>($"/api/items/{story.Id}"))!;
        Assert.Equal(("Volunteer check-in kiosk v2", "InProgress", 5, cast.Member.ProfileId, "Ruth Alvarez"), (read.Title, read.Status, read.StoryPoints, read.AssigneeId, read.AssigneeName));
        Assert.True(Assert.Single(read.Tasks).IsDone);
        Assert.Equal((true, false), (read.CanEdit, read.CanManage));
    }

    [Fact]
    public async Task Given_a_member_who_is_not_the_owner_when_they_edit_an_epic_then_403()
    {
        var cast = await factory.AddCastAsync();
        var epic = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Epic", "Owner's epic")));

        var response = await factory.MemberClient(cast).PutAsJsonAsync($"/api/items/{epic.Id}", new { Title = "Mine now", Description = "", Status = "Done" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Given_an_item_assigned_to_a_member_when_saved_then_the_assignee_is_notified_in_app_and_by_email()
    {
        var cast = await factory.AddCastAsync();

        var story = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync(
            $"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Volunteer check-in kiosk", assigneeId: cast.Member.ProfileId, storyPoints: 5)));

        var notification = await factory.WithDbAsync(db => db.Notifications.SingleAsync(n => n.RecipientId == cast.Member.ProfileId));
        Assert.Equal((NotificationKind.WorkItemAssigned, "Grace Okonkwo assigned you Volunteer check-in kiosk", $"/workspaces/{cast.WorkspaceId}/items/{story.Id}"),
            (notification.Kind, notification.Title, notification.LinkPath));
        var email = Assert.Single(factory.Emails.SentTo(await factory.EmailOfAsync(cast.Member)));
        Assert.Equal("Grace assigned you: Volunteer check-in kiosk", email.Subject);
        Assert.Contains("in the Toronto team workspace", email.Body);
    }

    [Fact]
    public async Task Given_someone_who_assigns_themselves_then_no_notification_is_sent()
    {
        var cast = await factory.AddCastAsync();

        await factory.MemberClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Mine", assigneeId: cast.Member.ProfileId));

        Assert.False(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == cast.Member.ProfileId)));
    }

    [Fact]
    public async Task Given_an_assignee_who_is_not_a_member_when_the_item_is_saved_then_the_api_rejects_it()
    {
        var cast = await factory.AddCastAsync();
        var items = $"/api/workspaces/{cast.WorkspaceId}/items";

        var create = await factory.OwnerClient(cast).PostAsJsonAsync(items, New("Story", "Kiosk", assigneeId: cast.Outsider.ProfileId));
        var story = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync(items, New("Story", "Kiosk")));
        var edit = await factory.OwnerClient(cast).PutAsJsonAsync($"/api/items/{story.Id}", new { Title = "Kiosk", Description = "", Status = "ToDo", AssigneeId = cast.Outsider.ProfileId });

        Assert.Equal((HttpStatusCode.BadRequest, HttpStatusCode.BadRequest), (create.StatusCode, edit.StatusCode));
        Assert.Equal(["Choose someone in this workspace."], (await create.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["AssigneeId"]);
    }

    [Fact]
    public async Task Given_a_task_when_it_is_given_story_points_then_400()
    {
        var cast = await factory.AddCastAsync();
        var items = $"/api/workspaces/{cast.WorkspaceId}/items";
        var story = await CreatedAsync(await factory.MemberClient(cast).PostAsJsonAsync(items, New("Story", "Kiosk")));

        var response = await factory.MemberClient(cast).PostAsJsonAsync(items, New("Task", "Buy tablets", story.Id, storyPoints: 3));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Given_a_member_when_they_comment_then_the_comment_shows_newest_first_with_its_author()
    {
        var cast = await factory.AddCastAsync();
        var story = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Briefs")));

        var first = await factory.OwnerClient(cast).PostAsJsonAsync($"/api/items/{story.Id}/comments", new { Body = "Harbour Light interview done." });
        factory.Time.Advance(TimeSpan.FromMinutes(5));
        var second = await factory.MemberClient(cast).PostAsJsonAsync($"/api/items/{story.Id}/comments", new { Body = "Two shelters want to co-present." });

        Assert.Equal((HttpStatusCode.Created, HttpStatusCode.Created), (first.StatusCode, second.StatusCode));
        var read = (await factory.StaffClient(cast).GetFromJsonAsync<Item>($"/api/items/{story.Id}"))!;
        Assert.Equal(["Two shelters want to co-present.", "Harbour Light interview done."], read.Comments.Select(c => c.Body));
        Assert.Equal(["Ruth Alvarez", "Grace Okonkwo"], read.Comments.Select(c => c.AuthorName));
    }

    [Fact]
    public async Task Given_an_empty_comment_then_400()
    {
        var cast = await factory.AddCastAsync();
        var story = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Briefs")));

        var response = await factory.MemberClient(cast).PostAsJsonAsync($"/api/items/{story.Id}/comments", new { Body = "  " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Given_staff_when_they_read_items_they_can_but_every_write_is_403()
    {
        var cast = await factory.AddCastAsync();
        var story = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Briefs")));
        var staff = factory.StaffClient(cast);

        var read = await staff.GetFromJsonAsync<Item>($"/api/items/{story.Id}");
        var writes = new[]
        {
            await staff.PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Staff story")),
            await staff.PutAsJsonAsync($"/api/items/{story.Id}", new { Title = "Edited", Description = "", Status = "Done" }),
            await staff.PostAsJsonAsync($"/api/items/{story.Id}/comments", new { Body = "Hello" }),
        };

        Assert.Equal((false, false), (read!.CanEdit, read.CanManage));
        Assert.All(writes, w => Assert.Equal(HttpStatusCode.Forbidden, w.StatusCode));
    }

    [Fact]
    public async Task Given_an_outsider_when_they_request_items_then_404()
    {
        var cast = await factory.AddCastAsync();
        var story = await CreatedAsync(await factory.OwnerClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Briefs")));
        var outsider = factory.OutsiderClient(cast);

        var responses = new[]
        {
            await outsider.GetAsync($"/api/items/{story.Id}"),
            await outsider.GetAsync($"/api/workspaces/{cast.WorkspaceId}/backlog"),
            await outsider.PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Story", "Sneaky")),
            await outsider.PostAsJsonAsync($"/api/items/{story.Id}/comments", new { Body = "Hello" }),
        };

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.NotFound, r.StatusCode));
    }

    [Fact]
    public async Task Given_a_system_admin_when_they_create_an_item_in_any_workspace_then_it_is_audited()
    {
        var cast = await factory.AddCastAsync();

        var epic = await CreatedAsync(await factory.AdminClient(cast).PostAsJsonAsync($"/api/workspaces/{cast.WorkspaceId}/items", New("Epic", "Admin epic")));

        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == epic.Id.ToString()));
        Assert.Equal(("workitem.created", cast.Admin.ProfileId), (entry.Action, entry.ActorId));
    }

    [Fact]
    public async Task Given_the_backlog_when_shown_then_initiatives_epics_and_stories_appear_as_a_tree_that_can_be_filtered()
    {
        var cast = await factory.AddCastAsync();
        var owner = factory.OwnerClient(cast);
        var items = $"/api/workspaces/{cast.WorkspaceId}/items";
        var initiative = await CreatedAsync(await owner.PostAsJsonAsync(items, New("Initiative", "Launch the hackathon season")));
        var epic = await CreatedAsync(await owner.PostAsJsonAsync(items, New("Epic", "Tech for Shelters hackathon", initiative.Id)));
        var other = await CreatedAsync(await owner.PostAsJsonAsync(items, New("Epic", "Monthly Builders Night")));
        var story = await CreatedAsync(await owner.PostAsJsonAsync(items, New("Story", "Shelter problem briefs", epic.Id)));
        await owner.PostAsJsonAsync(items, New("Task", "Edit six briefs", story.Id));
        await owner.PostAsJsonAsync(items, New("Story", "Book AV", other.Id));
        await owner.PostAsJsonAsync(items, New("Story", "Update the city team photo"));
        var backlog = $"/api/workspaces/{cast.WorkspaceId}/backlog";

        var all = (await owner.GetFromJsonAsync<Node[]>(backlog))!;
        var byInitiative = (await owner.GetFromJsonAsync<Node[]>($"{backlog}?initiativeId={initiative.Id}"))!;
        var byEpic = (await owner.GetFromJsonAsync<Node[]>($"{backlog}?epicId={other.Id}"))!;
        var noEpic = (await owner.GetFromJsonAsync<Node[]>($"{backlog}?noEpic=true"))!;

        Assert.Equal(["Launch the hackathon season", "Monthly Builders Night", "Update the city team photo"], all.Select(n => n.Title));
        var tree = all[0];
        Assert.Equal("Tech for Shelters hackathon", Assert.Single(tree.Children).Title);
        var storyNode = Assert.Single(tree.Children[0].Children);
        Assert.Equal(("Story", "Edit six briefs"), (storyNode.Kind, Assert.Single(storyNode.Children).Title));
        Assert.Equal(["Launch the hackathon season"], byInitiative.Select(n => n.Title));
        Assert.Equal(["Monthly Builders Night"], byEpic.Select(n => n.Title));
        Assert.Equal(["Update the city team photo"], noEpic.Select(n => n.Title));
    }
}
