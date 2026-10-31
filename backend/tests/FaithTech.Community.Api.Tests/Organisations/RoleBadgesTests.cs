// Traces to: L2-141 AC3
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Invites;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations;

/// <summary>
/// A tagged assignment names its chapter wherever a role badge shows, so it reads "{role} · {chapter}": on a profile, in
/// People, on the team list and on the connect page.
/// </summary>
public class RoleBadgesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record HeldRole(Guid Id, string Name, Guid? ChapterId, string? ChapterName);

    public record Profile(HeldRole[] Roles);

    [Fact]
    public async Task A_profile_and_People_name_each_assignments_chapter()
    {
        var austin = (await factory.AddChapterAsync("Austin")).Id;
        var volunteer = factory.RoleIdOf("Volunteer");
        var esther = await factory.AddMemberAsync("Esther Nakamura", p =>
        {
            p.AddRole(volunteer, Guid.Empty, DateTime.UtcNow, austin);
            p.AddRole(factory.RoleIdOf("ProductEngineer"), Guid.Empty, DateTime.UtcNow);
        });
        var viewer = factory.ClientFor(await factory.AddMemberAsync("Sam Staff"), Role.Staff);

        var profile = await viewer.GetFromJsonAsync<Profile>($"/api/profiles/{esther.ProfileId}");
        var people = await viewer.GetFromJsonAsync<JsonElement>("/api/people?q=Esther%20Nakamura");

        Assert.Contains(profile!.Roles, r => r.Name == "Volunteer" && r.ChapterName == "Austin");
        Assert.Contains(profile.Roles, r => r.Name == "Product Engineer" && r.ChapterName == null);
        var roles = people.GetProperty("items")[0].GetProperty("roles").EnumerateArray()
            .Select(r => (r.GetProperty("name").GetString(), r.GetProperty("chapterName").GetString()));
        Assert.Contains(("Volunteer", "Austin"), roles);
    }

    [Fact]
    public async Task The_team_list_reads_role_and_chapter()
    {
        var austin = (await factory.AddChapterAsync("Austin")).Id;
        var volunteer = factory.RoleIdOf("Volunteer");
        await factory.AddMemberAsync("Ines Badge", p =>
        {
            p.AddRole(volunteer, Guid.Empty, DateTime.UtcNow, austin);
            p.AddRole(factory.RoleIdOf("EventLead"), Guid.Empty, DateTime.UtcNow);
        });
        var viewer = factory.ClientFor(await factory.AddMemberAsync("Sam Staff"), Role.Staff);

        var team = await viewer.GetFromJsonAsync<JsonElement>("/api/team?pageSize=100");

        var ines = team.GetProperty("members").EnumerateArray().Single(m => m.GetProperty("name").GetString() == "Ines Badge");
        Assert.Equal(["Event Lead", "Volunteer · Austin"], ines.GetProperty("roleBadges").EnumerateArray().Select(b => b.GetString()));
    }

    [Fact]
    public async Task The_connect_page_names_the_chapter_of_the_link_role()
    {
        var austin = (await factory.AddChapterAsync("Austin")).Id;
        var cityLead = factory.RoleIdOf("CityLead");
        var grace = await factory.AddMemberAsync("Grace Tagged", p => p.AddRole(cityLead, Guid.Empty, DateTime.UtcNow, austin));
        var token = await factory.ConnectTokenOfAsync(grace);

        var response = await factory.CreateClient().PostAsJsonAsync("/api/connect/lookup", new { token });
        var lookup = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("City Lead", lookup.GetProperty("leadRole").GetString());
        Assert.Equal("Austin", lookup.GetProperty("leadRoleChapterName").GetString());
    }
}
