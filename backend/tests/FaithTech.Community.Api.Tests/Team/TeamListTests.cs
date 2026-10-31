// Traces to: L2-019
using FaithTech.Community.Api.Tests.Organisations;
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Team;

public class TeamListTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly DateTimeOffset Earlier = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Anonymous_visitor_gets_401_for_the_team()
    {
        var response = await factory.CreateClient().GetAsync("/api/team");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC1: Given any signed-in member, when they open the team page, then it lists every profile holding a
    // lead or volunteer role, with name, photo and roles.
    [Fact]
    public async Task Member_sees_every_lead_and_volunteer_with_name_photo_and_roles_by_name()
    {
        var team = new TeamFactory(factory);
        var samuel = await team.AddAsync("Samuel Mensah", "Toronto", Role.CreateLead, Role.ProductEngineer);
        await team.AddAsync("Ruth Alvarez", "Toronto", Role.Volunteer);
        await team.AddAsync("Grace Okonkwo", "Toronto", Role.CityLead);
        await team.AddAsync("Nate Oyelaran", "Toronto", Role.ProductEngineer);
        await team.AddAsync("Felix Wu", "Austin");
        var viewer = await factory.AddMemberAsync("Leah Thompson");

        var list = await factory.ClientFor(viewer).GetFromJsonAsync<TeamListResponse>(team.Url());

        Assert.Equal(["Grace Okonkwo", "Ruth Alvarez", "Samuel Mensah"], team.Mine(list!).Select(m => m.Name));
        var samuelRow = list!.Members.Single(m => m.ProfileId == samuel.ProfileId);
        Assert.Equal(["CreateLead", "ProductEngineer"], samuelRow.Roles);
        Assert.Equal("Toronto", samuelRow.ChapterName);
        Assert.Equal($"{FakePhotoStorage.BaseUrl}profiles/{samuel.ProfileId}/featured.jpg", samuelRow.PhotoUrl);
        Assert.Null(list.Members.Single(m => m.Name.StartsWith("Ruth") && team.Owns(m)).PhotoUrl);
    }

    // AC2: Given a role filter (Leads or Volunteers) or a chapter filter (L2-142 AC2), when it is applied, then
    // only matching team members are listed. "{Name}" in the query stands for that chapter's id.
    [Theory]
    [InlineData("?role=Leads", new[] { "Grace Okonkwo", "Hannah Kim", "Marcus Lee" })]
    [InlineData("?role=Volunteers", new[] { "Ruth Alvarez", "Tomasz Nowak" })]
    [InlineData("?chapter={Vancouver}", new[] { "Hannah Kim", "Tomasz Nowak" })]
    [InlineData("?role=Volunteers&chapter={Toronto}", new[] { "Ruth Alvarez" })]
    [InlineData("?role=leads&chapter={Austin}", new[] { "Marcus Lee" })]
    public async Task Role_and_chapter_filters_narrow_the_team(string query, string[] expected)
    {
        var team = new TeamFactory(factory);
        await team.AddAsync("Grace Okonkwo", "Toronto", Role.CityLead);
        await team.AddAsync("Marcus Lee", "Austin", Role.EventLead);
        await team.AddAsync("Hannah Kim", "Vancouver", Role.CommunicationsLead);
        await team.AddAsync("Ruth Alvarez", "Toronto", Role.Volunteer, Role.Attendee);
        await team.AddAsync("Tomasz Nowak", "Vancouver", Role.Volunteer);
        var viewer = await factory.AddMemberAsync("Leah Thompson");

        foreach (var name in new[] { "Vancouver", "Toronto", "Austin" })
        {
            query = query.Replace($"{{{name}}}", (await factory.ChapterIdAsync(name)).ToString());
        }

        var list = await factory.ClientFor(viewer).GetFromJsonAsync<TeamListResponse>(team.Url(query));

        Assert.Equal(expected, team.Mine(list!).Select(m => m.Name));
    }

    // AC3: Given a profile that loses its last lead or volunteer role, when the team page is viewed, then that
    // profile no longer appears.
    [Fact]
    public async Task Profile_that_loses_its_last_team_role_drops_off_and_one_keeping_a_team_role_stays()
    {
        var team = new TeamFactory(factory);
        var ruth = await team.AddAsync("Ruth Alvarez", "Toronto", Role.Volunteer, Role.Attendee);
        var marcus = await team.AddAsync("Marcus Lee", "Toronto", Role.EventLead, Role.Volunteer);
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var lead = factory.ClientFor(grace, Role.CityLead);
        Assert.Equal(["Marcus Lee", "Ruth Alvarez"], team.Mine((await lead.GetFromJsonAsync<TeamListResponse>(team.Url()))!).Select(m => m.Name));

        (await lead.DeleteAsync($"/api/profiles/{ruth.ProfileId}/roles/{factory.RoleIdOf("Volunteer")}")).EnsureSuccessStatusCode();
        (await lead.DeleteAsync($"/api/profiles/{marcus.ProfileId}/roles/{factory.RoleIdOf("Volunteer")}")).EnsureSuccessStatusCode();

        var list = await lead.GetFromJsonAsync<TeamListResponse>(team.Url());
        var marcusRow = Assert.Single(team.Mine(list!));
        Assert.Equal(marcus.ProfileId, marcusRow.ProfileId);
        Assert.Equal(["EventLead"], marcusRow.Roles);
    }

    [Theory]
    [InlineData("?role=Staff")]
    [InlineData("?role=7")]
    public async Task Unknown_role_filter_is_400(string query)
    {
        var viewer = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(viewer).GetAsync($"/api/team{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    public sealed record TeamMemberResponse(Guid ProfileId, string Name, string? ChapterName, string? PhotoUrl, string[] Roles);

    public sealed record TeamListResponse(TeamMemberResponse[] Members);

    /// <summary>Adds team members and remembers them, so tests sharing one database only look at their own.</summary>
    private sealed class TeamFactory(CommunityApiFactory factory)
    {
        private readonly HashSet<Guid> _ids = [];

        public async Task<ProfileClients.Member> AddAsync(string name, string? city, params Role[] roles)
        {
            var chapterId = await factory.ChapterIdAsync(city);
            var member = await factory.AddMemberAsync(name, p =>
            {
                p.Update(name, chapterId, null);
                foreach (var role in roles)
                {
                    p.AddRole(role, Guid.Empty, DateTime.UtcNow);
                }

                if (roles.Contains(Role.CreateLead))
                {
                    p.AddPhoto(new ProfilePhoto($"profiles/{p.Id}/featured.jpg", $"{name} at Builders Night", Earlier));
                    p.AddPhoto(new ProfilePhoto($"profiles/{p.Id}/other.jpg", "The hackathon team", Earlier.AddDays(1)));
                }
            });
            _ids.Add(member.ProfileId);
            return member;
        }

        // Tests share one database, so ask for the largest page to see every member they added.
        public string Url(string query = "") => "/api/team" + (query.Length == 0 ? "?pageSize=100" : query + "&pageSize=100");

        public bool Owns(TeamMemberResponse member) => _ids.Contains(member.ProfileId);

        public IEnumerable<TeamMemberResponse> Mine(TeamListResponse list) => list.Members.Where(Owns);
    }
}
