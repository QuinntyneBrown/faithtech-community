// Traces to: L2-019
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
        Assert.Equal("Toronto", samuelRow.HomeCity);
        Assert.Equal($"{FakePhotoStorage.BaseUrl}profiles/{samuel.ProfileId}/featured.jpg", samuelRow.PhotoUrl);
        Assert.Null(list.Members.Single(m => m.Name.StartsWith("Ruth") && team.Owns(m)).PhotoUrl);
    }

    public sealed record TeamMemberResponse(Guid ProfileId, string Name, string? HomeCity, string? PhotoUrl, string[] Roles);

    public sealed record TeamListResponse(TeamMemberResponse[] Members, string[] Cities);

    /// <summary>Adds team members and remembers them, so tests sharing one database only look at their own.</summary>
    private sealed class TeamFactory(CommunityApiFactory factory)
    {
        private readonly HashSet<Guid> _ids = [];

        public async Task<ProfileClients.Member> AddAsync(string name, string? city, params Role[] roles)
        {
            var member = await factory.AddMemberAsync(name, p =>
            {
                p.Update(name, city, null);
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

        public string Url(string query = "") => "/api/team" + query;

        public bool Owns(TeamMemberResponse member) => _ids.Contains(member.ProfileId);

        public IEnumerable<TeamMemberResponse> Mine(TeamListResponse list) => list.Members.Where(Owns);
    }
}
