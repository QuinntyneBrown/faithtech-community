// Traces to: L2-026
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Search;

public class GlobalSearchTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    /// <summary>A word no other test uses, so tests sharing one database only find their own records.</summary>
    private readonly string _word = "shelter" + string.Concat(Guid.NewGuid().ToString("N").Where(char.IsLetter).Take(8));

    // AC2: Given any user, when results are built, then they include only items that user is permitted to open:
    // own contacts only, partners only for leads, Staff and System Admin, and work items only for workspace members,
    // Staff and System Admin.
    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Contacts_found_are_only_the_callers_own_active_contacts(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p => p.AddRole(role, Guid.Empty, DateTime.UtcNow));
        var esther = await factory.AddMemberAsync("Esther Nakamura", p => p.AddRole(Role.CityLead, Guid.Empty, DateTime.UtcNow));
        await AddContactAsync(grace, $"Tomás Ortega {_word}");
        await AddContactAsync(grace, $"Archived {_word}", archived: true);
        await AddContactAsync(esther, $"Esther's contact {_word}");

        var results = await SearchAsync(factory.ClientFor(grace, role), _word);

        Assert.Equal([$"Tomás Ortega {_word}"], Titles(results, "Contact"));
    }

    [Theory]
    [InlineData(Role.CityLead, true)]
    [InlineData(Role.EventLead, true)]
    [InlineData(Role.CommunicationsLead, true)]
    [InlineData(Role.Staff, true)]
    [InlineData(Role.SystemAdmin, true)]
    [InlineData(Role.Volunteer, false)]
    [InlineData(Role.ProductEngineer, false)]
    public async Task Partners_are_found_only_by_leads_staff_and_system_admin(Role role, bool sees)
    {
        var caller = await factory.AddMemberAsync("Jonah Bell", p => p.AddRole(role, Guid.Empty, DateTime.UtcNow));
        await factory.WithDbAsync(async db =>
        {
            db.Partners.Add(new Partner($"Lantern Foundation {_word}", null, "Funds shelter technology", null, null, null, null, null, PartnerStage.InFunnel));
            return await db.SaveChangesAsync();
        });

        var results = await SearchAsync(factory.ClientFor(caller, role), _word);

        Assert.Equal(sees ? [$"Lantern Foundation {_word}"] : [], Titles(results, "Partner"));
        Assert.Equal(sees, results.Groups.Any(g => g.Kind == "Partner"));
    }

    [Fact]
    public async Task Work_items_are_found_only_in_the_callers_workspaces()
    {
        var owner = await factory.AddMemberAsync("Grace Okonkwo", p => p.AddRole(Role.CityLead, Guid.Empty, DateTime.UtcNow));
        var member = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));
        var outsider = await factory.AddMemberAsync("Samuel Mensah", p => p.AddRole(Role.CreateLead, Guid.Empty, DateTime.UtcNow));
        var workspace = await AddWorkspaceAsync(owner, member, $"Shelter problem briefs {_word}", $"Archived brief {_word}");

        var ownerResults = await SearchAsync(factory.ClientFor(owner, Role.CityLead), _word);
        var memberResults = await SearchAsync(factory.ClientFor(member, Role.Volunteer), _word);
        var outsiderResults = await SearchAsync(factory.ClientFor(outsider, Role.CreateLead), _word);

        Assert.Equal([$"Shelter problem briefs {_word}"], Titles(ownerResults, "WorkItem"));
        Assert.Equal([$"Shelter problem briefs {_word}"], Titles(memberResults, "WorkItem"));
        Assert.Empty(Titles(outsiderResults, "WorkItem"));
        var item = memberResults.Groups.Single(g => g.Kind == "WorkItem").Items.Single();
        Assert.StartsWith($"/workspaces/{workspace}/items/", item.Route);
    }

    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task Staff_and_system_admin_find_work_items_in_every_workspace(Role role)
    {
        var owner = await factory.AddMemberAsync("Grace Okonkwo", p => p.AddRole(Role.CityLead, Guid.Empty, DateTime.UtcNow));
        var member = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));
        var overseer = await factory.AddMemberAsync("Daniel Reyes", p => p.AddRole(role, Guid.Empty, DateTime.UtcNow));
        await AddWorkspaceAsync(owner, member, $"Intake form {_word}", $"Old intake {_word}");

        var results = await SearchAsync(factory.ClientFor(overseer, role), _word);

        Assert.Equal([$"Intake form {_word}"], Titles(results, "WorkItem"));
    }

    // AC1: Given a signed-in member, when they search, then results are grouped into people, events, partners,
    // contacts and work items, using Postgres full-text search.
    [Fact]
    public async Task A_member_finds_people_by_name_city_or_bio_by_word_prefix()
    {
        var ruth = await factory.AddMemberAsync($"Ruth Alvarez", p =>
        {
            p.Update("Ruth Alvarez", "Toronto", $"Led the {_word} intake team");
            p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow);
        });
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var results = await SearchAsync(factory.ClientFor(jonah), _word[..^2].ToUpperInvariant());

        var person = Assert.Single(results.Groups.Single(g => g.Kind == "Person").Items);
        Assert.Equal("Ruth Alvarez", person.Title);
        Assert.Equal($"/people/{ruth.ProfileId}", person.Route);
        Assert.Equal($"Volunteer · Toronto · Led the {_word} intake team", person.Snippet);
        Assert.Equal(["Person"], results.Groups.Select(g => g.Kind));
    }

    // AC1, the events group: every signed-in member finds events by title, description, city or venue.
    [Fact]
    public async Task A_member_finds_events_by_title_city_or_venue()
    {
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var hackathon = await factory.AddEventAsync($"Hackathon: Tech for {_word}", TimeSpan.FromDays(14), type: EventType.Hackathon);

        var results = await SearchAsync(factory.ClientFor(jonah), _word);

        var found = Assert.Single(results.Groups.Single(g => g.Kind == "Event").Items);
        Assert.Equal((hackathon.Id, $"Hackathon: Tech for {_word}", $"/events/{hackathon.Id}"), (found.Id, found.Title, found.Route));
        Assert.Contains("Toronto", found.Snippet);
    }

    [Fact]
    public async Task Groups_come_in_a_fixed_order_and_every_word_must_match()
    {
        var grace = await factory.AddMemberAsync($"Grace {_word}", p => p.AddRole(Role.CityLead, Guid.Empty, DateTime.UtcNow));
        await AddContactAsync(grace, $"Tomás {_word}");
        await factory.WithDbAsync(async db =>
        {
            db.Partners.Add(new Partner($"Lantern {_word}", null, null, null, null, null, null, null));
            return await db.SaveChangesAsync();
        });

        var results = await SearchAsync(factory.ClientFor(grace, Role.CityLead), _word);
        var narrowed = await SearchAsync(factory.ClientFor(grace, Role.CityLead), $"{_word} lantern");

        Assert.Equal(["Person", "Partner", "Contact"], results.Groups.Select(g => g.Kind));
        Assert.Equal(["Partner"], narrowed.Groups.Select(g => g.Kind));
    }

    // AC3: Given no matches, when the search completes, then an empty state suggests other terms.
    [Fact]
    public async Task No_match_returns_no_groups()
    {
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var results = await SearchAsync(factory.ClientFor(jonah), _word + "zebra");

        Assert.Empty(results.Groups);
    }

    // AC4: Given a search term shorter than 2 characters, when it is submitted, then no search runs and a hint is shown.
    [Theory]
    [InlineData("")]
    [InlineData("s")]
    [InlineData(" s ")]
    public async Task A_term_under_two_characters_is_400(string term)
    {
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var response = await factory.ClientFor(jonah).GetAsync($"/api/search?q={Uri.EscapeDataString(term)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Anonymous_visitor_gets_401()
    {
        var response = await factory.CreateClient().GetAsync("/api/search?q=shelter");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Each_group_returns_at_most_ten_results()
    {
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        for (var i = 0; i < 12; i++)
        {
            await factory.AddMemberAsync($"Member {i} {_word}");
        }

        var results = await SearchAsync(factory.ClientFor(jonah), _word);

        Assert.Equal(10, results.Groups.Single(g => g.Kind == "Person").Items.Length);
    }

    private async Task<SearchResponse> SearchAsync(HttpClient client, string term)
    {
        var response = await client.GetAsync($"/api/search?q={Uri.EscapeDataString(term)}");
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SearchResponse>())!;
    }

    private static string[] Titles(SearchResponse results, string kind) =>
        [.. results.Groups.Where(g => g.Kind == kind).SelectMany(g => g.Items).Select(i => i.Title).Order()];

    private Task AddContactAsync(ProfileClients.Member owner, string name, bool archived = false) =>
        factory.WithDbAsync(async db =>
        {
            var contact = new Contact(owner.ProfileId, name, null, null, "Harbour Light", "Toronto", DateTime.UtcNow);
            if (archived)
            {
                contact.Archive(DateTime.UtcNow);
            }

            db.Contacts.Add(contact);
            return await db.SaveChangesAsync();
        });

    /// <summary>A workspace owned by one member with another as member, an active item and an archived one.</summary>
    private Task<Guid> AddWorkspaceAsync(ProfileClients.Member owner, ProfileClients.Member member, string active, string archived) =>
        factory.WithDbAsync(async db =>
        {
            var memberProfile = await db.Profiles.FindAsync(member.ProfileId);
            var workspace = new Workspace("Toronto team", WorkspaceMethod.Kanban, owner.ProfileId);
            workspace.AddMember(memberProfile!, DateTimeOffset.UtcNow);
            var item = new WorkItem(workspace.Id, WorkItemKind.Story, active, "Briefs for the teams", null);
            var old = new WorkItem(workspace.Id, WorkItemKind.Story, archived, "", null);
            old.Archive([old], owner.ProfileId, DateTimeOffset.UtcNow);
            db.Workspaces.Add(workspace);
            db.WorkItems.AddRange(item, old);
            await db.SaveChangesAsync();
            return workspace.Id;
        });

    public sealed record SearchItemResponse(Guid Id, string Title, string Snippet, string Route);

    public sealed record SearchGroupResponse(string Kind, SearchItemResponse[] Items);

    public sealed record SearchResponse(SearchGroupResponse[] Groups);
}
