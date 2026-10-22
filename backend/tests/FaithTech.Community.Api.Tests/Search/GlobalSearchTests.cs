// Traces to: L2-026, L2-042
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Agile;
using FaithTech.Community.Api.Tests.Contacts;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Partners;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Search;

public class GlobalSearchTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Item(Guid Id, string Title, string Snippet, string Route, DateTimeOffset? StartsAt, string? Badge);

    public sealed record Group(string Kind, Item[] Items);

    public sealed record Results(Group[] Groups);

    /// <summary>A word no other test uses, so each test sees only its own records.</summary>
    private static string Word() => "Shelter" + Guid.NewGuid().ToString("N")[..8];

    // L2-026 AC2: permission rules first.

    [Fact]
    public async Task A_lead_finds_only_their_own_private_contacts()
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var mine = await factory.CreateContactAsync(grace, $"Tomás {word}");
        await factory.CreateContactAsync(marcus, $"Abby {word}");

        var results = await SearchAsync(factory.ClientFor(grace, Role.CityLead), word);

        var contacts = Assert.Single(results.Groups, g => g.Kind == "Contact");
        var item = Assert.Single(contacts.Items);
        Assert.Equal((mine.Id, $"/contacts/{mine.Id}", "Private"), (item.Id, item.Route, item.Badge));
    }

    [Fact]
    public async Task A_system_admin_also_finds_only_their_own_contacts()
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var priya = await factory.AddMemberAsync("Priya Shah");
        await factory.CreateContactAsync(grace, $"Tomás {word}");

        var results = await SearchAsync(factory.ClientFor(priya, Role.SystemAdmin), word);

        Assert.DoesNotContain(results.Groups, g => g.Kind == "Contact");
    }

    [Fact]
    public async Task Archived_contacts_are_left_out()
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, $"Tomás {word}");
        var client = factory.ClientFor(grace, Role.CityLead);
        await client.PostAsync($"/api/contacts/{contact.Id}/archive", null);

        var results = await SearchAsync(client, word);

        Assert.Empty(results.Groups);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task Leads_staff_and_system_admins_find_partners(Role role)
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, $"Lantern {word} Foundation");
        var searcher = await factory.AddMemberAsync("Searcher");

        var results = await SearchAsync(factory.ClientFor(searcher, role), word);

        var item = Assert.Single(Assert.Single(results.Groups, g => g.Kind == "Partner").Items);
        Assert.Equal((partner.Id, $"/partners/{partner.Id}", "Lead"), (item.Id, item.Route, item.Badge));
    }

    [Theory]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.ProductEngineer)]
    [InlineData(Role.Attendee)]
    public async Task Other_members_never_see_partners(Role role)
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.CreatePartnerAsync(grace, $"Lantern {word} Foundation");
        var searcher = await factory.AddMemberAsync("Searcher");

        var results = await SearchAsync(factory.ClientFor(searcher, role), word);

        Assert.DoesNotContain(results.Groups, g => g.Kind == "Partner");
    }

    [Fact]
    public async Task Work_items_are_found_by_workspace_members_staff_and_system_admins_only()
    {
        var word = Word();
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, $"{word} problem briefs for teams");
        var outsiderLead = await factory.AddWithRolesAsync("Esther Nakamura", Role.CityLead);

        foreach (var client in new[] { factory.OwnerClient(cast), factory.MemberClient(cast), factory.StaffClient(cast), factory.AdminClient(cast) })
        {
            var item = Assert.Single(Assert.Single((await SearchAsync(client, word)).Groups, g => g.Kind == "WorkItem").Items);
            Assert.Equal((story, $"/workspaces/{cast.WorkspaceId}/items/{story}"), (item.Id, item.Route));
            Assert.Contains("Toronto team", item.Snippet);
        }

        Assert.DoesNotContain((await SearchAsync(factory.OutsiderClient(cast), word)).Groups, g => g.Kind == "WorkItem");
        Assert.DoesNotContain((await SearchAsync(factory.ClientFor(outsiderLead, Role.CityLead), word)).Groups, g => g.Kind == "WorkItem");
    }

    [Fact]
    public async Task Archived_work_items_are_left_out()
    {
        var word = Word();
        var cast = await factory.AddCastAsync();
        var story = await factory.AddStoryAsync(cast.WorkspaceId, $"{word} archived story");
        await factory.WithDbAsync(async db =>
        {
            var item = await db.WorkItems.SingleAsync(i => i.Id == story);
            item.Archive([item], cast.Owner.ProfileId, DateTimeOffset.UtcNow);
            return await db.SaveChangesAsync();
        });

        var results = await SearchAsync(factory.AdminClient(cast), word);

        Assert.DoesNotContain(results.Groups, g => g.Kind == "WorkItem");
    }

    // L2-026 AC1: grouped results.

    [Fact]
    public async Task A_member_gets_people_and_events_grouped_and_nothing_they_may_not_open()
    {
        var word = Word();
        var ruth = await factory.AddMemberAsync($"Ruth {word}", p =>
        {
            p.Update(p.Name, "Toronto", "Led the intake team.");
            p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow);
        });
        var ev = await factory.AddEventAsync($"Hackathon: Tech for {word}", TimeSpan.FromDays(20));
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.CreateContactAsync(grace, $"Tomás {word}");
        await factory.CreatePartnerAsync(grace, $"Lantern {word}");
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var results = await SearchAsync(factory.ClientFor(jonah, Role.ProductEngineer), word);

        Assert.Equal(["Person", "Event"], results.Groups.Select(g => g.Kind));
        var person = Assert.Single(results.Groups[0].Items);
        Assert.Equal((ruth.ProfileId, $"Ruth {word}", $"/people/{ruth.ProfileId}"), (person.Id, person.Title, person.Route));
        Assert.Contains("Volunteer", person.Snippet);
        Assert.Contains("Toronto", person.Snippet);
        var found = Assert.Single(results.Groups[1].Items);
        Assert.Equal((ev.Id, $"/events/{ev.Id}", (DateTimeOffset?)ev.StartsAt), (found.Id, found.Route, found.StartsAt));
    }

    [Fact]
    public async Task Groups_come_in_the_order_people_events_partners_contacts_work_items()
    {
        var word = Word();
        var cast = await factory.AddCastAsync();
        await factory.AddStoryAsync(cast.WorkspaceId, $"{word} story");
        await factory.AddMemberAsync($"Person {word}");
        await factory.AddEventAsync($"Event {word}", TimeSpan.FromDays(3));
        await factory.CreatePartnerAsync(cast.Owner, $"Partner {word}");
        await factory.CreateContactAsync(cast.Owner, $"Contact {word}");

        var results = await SearchAsync(factory.OwnerClient(cast), word);

        Assert.Equal(["Person", "Event", "Partner", "Contact", "WorkItem"], results.Groups.Select(g => g.Kind));
    }

    [Fact]
    public async Task Search_matches_every_word_ignoring_case_across_the_searchable_fields()
    {
        var word = Word();
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.Update(p.Name, "Toronto", $"Runs the {word} intake team."));
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var both = await SearchAsync(factory.ClientFor(jonah), $"{word.ToUpperInvariant()} intake");
        var notBoth = await SearchAsync(factory.ClientFor(jonah), $"{word} Vancouver");

        Assert.Equal(ruth.ProfileId, Assert.Single(Assert.Single(both.Groups).Items).Id);
        Assert.Empty(notBoth.Groups);
    }

    [Fact]
    public async Task Suspended_members_are_not_found()
    {
        var word = Word();
        await factory.AddMemberAsync($"Gone {word}", p => p.Suspend("Spam", DateTime.UtcNow));
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var results = await SearchAsync(factory.ClientFor(jonah), word);

        Assert.Empty(results.Groups);
    }

    [Fact]
    public async Task Each_group_returns_at_most_ten_results()
    {
        var word = Word();
        for (var i = 0; i < 12; i++)
        {
            await factory.AddMemberAsync($"Person {i} {word}");
        }

        var results = await SearchAsync(factory.ClientFor(await factory.AddMemberAsync("Jonah Bell")), word);

        Assert.Equal(10, Assert.Single(results.Groups).Items.Length);
    }

    // L2-026 AC3, AC4.

    [Fact]
    public async Task No_matches_answers_with_no_groups()
    {
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var results = await SearchAsync(factory.ClientFor(jonah), Word());

        Assert.Empty(results.Groups);
    }

    [Theory]
    [InlineData("")]
    [InlineData("a")]
    [InlineData(" a ")]
    public async Task A_term_shorter_than_two_characters_runs_no_search(string term)
    {
        var jonah = await factory.AddMemberAsync("Jonah Bell");

        var response = await factory.ClientFor(jonah).GetAsync($"/api/search?q={Uri.EscapeDataString(term)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<Results> SearchAsync(HttpClient client, string term)
    {
        var response = await client.GetAsync($"/api/search?q={Uri.EscapeDataString(term)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<Results>())!;
    }
}
