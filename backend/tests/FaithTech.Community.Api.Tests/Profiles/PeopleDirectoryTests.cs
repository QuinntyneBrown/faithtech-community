// Traces to: L2-053
using FaithTech.Community.Api.Tests.Organisations;
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Profiles;

public class PeopleDirectoryTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly DateTimeOffset Earlier = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    // AC6: anonymous callers get 401 and no member data.
    [Fact]
    public async Task Anonymous_visitor_gets_401()
    {
        var response = await factory.CreateClient().GetAsync("/api/people");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC3, AC6: any other signed-in caller gets 403 and no member data.
    [Theory]
    [InlineData]
    [InlineData(Role.EventLead)]
    [InlineData(Role.Volunteer, Role.ProductEngineer)]
    public async Task Anyone_but_a_city_lead_staff_or_system_admin_gets_403(params Role[] roles)
    {
        var member = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(member, roles).GetAsync("/api/people");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.DoesNotContain("Leah", await response.Content.ReadAsStringAsync());
    }

    // AC1, AC5: City Lead, Staff and System Admin see members by name with photo, roles and home city, never email.
    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task Permitted_callers_see_members_by_name_with_photo_roles_and_city(Role role)
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        var toronto = await factory.ChapterIdAsync("Toronto");
        var samuel = await factory.AddMemberAsync($"Samuel {tag}", p =>
        {
            p.Update(p.Name, toronto, null);
            p.AddRole(Role.ProductEngineer, Guid.Empty, DateTime.UtcNow);
            p.AddRole(Role.CreateLead, Guid.Empty, DateTime.UtcNow);
            p.AddPhoto(new ProfilePhoto($"profiles/{p.Id}/featured.jpg", "Samuel at Builders Night", Earlier));
        });
        await factory.AddMemberAsync($"Leah {tag}");
        var viewer = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(viewer, role).GetAsync($"/api/people?q={tag}");
        var page = await response.Content.ReadFromJsonAsync<PeoplePage>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, page!.TotalCount);
        Assert.Equal(25, page.PageSize);
        Assert.Equal([$"Leah {tag}", $"Samuel {tag}"], page.Items.Select(p => p.Name));
        Assert.Empty(page.Items[0].Roles);
        Assert.Null(page.Items[0].PhotoUrl);
        var row = page.Items[1];
        Assert.Equal(samuel.ProfileId, row.Id);
        Assert.Equal("Toronto", row.HomeCity);
        Assert.Equal(["Create Lead", "Product Engineer"], row.Roles.Select(r => r.Name));
        Assert.Equal([factory.RoleIdOf(Role.CreateLead), factory.RoleIdOf(Role.ProductEngineer)], row.Roles.Select(r => r.Id));
        Assert.Equal($"{FakePhotoStorage.BaseUrl}profiles/{samuel.ProfileId}/featured.jpg", row.PhotoUrl);
        Assert.DoesNotContain("@example.org", await response.Content.ReadAsStringAsync());
    }

    // AC5: the term matches email as well as name, ignoring case.
    [Fact]
    public async Task Search_matches_email_and_ignores_case()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var email = await factory.WithDbAsync(db => db.Users.Where(u => u.Id == ruth.UserId).Select(u => u.Email!).SingleAsync());
        var viewer = await factory.AddMemberAsync("Grace Okonkwo");

        var page = await factory.ClientFor(viewer, Role.CityLead).GetFromJsonAsync<PeoplePage>($"/api/people?q={email[..12].ToUpperInvariant()}");

        Assert.Equal([ruth.ProfileId], page!.Items.Select(p => p.Id));
    }

    // AC4: no matches is an empty page, not an error.
    [Fact]
    public async Task No_matches_is_an_empty_page()
    {
        var viewer = await factory.AddMemberAsync("Grace Okonkwo");

        var page = await factory.ClientFor(viewer, Role.CityLead).GetFromJsonAsync<PeoplePage>("/api/people?q=xavier-nobody");

        Assert.Equal(0, page!.TotalCount);
        Assert.Empty(page.Items);
    }

    // AC5: 25 at a time.
    [Fact]
    public async Task Members_are_listed_25_at_a_time()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        for (var i = 0; i < 26; i++)
        {
            await factory.AddMemberAsync($"Member {tag} {i:00}");
        }

        var viewer = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(viewer, Role.Staff);
        var first = await client.GetFromJsonAsync<PeoplePage>($"/api/people?q={tag}");
        var second = await client.GetFromJsonAsync<PeoplePage>($"/api/people?q={tag}&page=2");

        Assert.Equal(26, first!.TotalCount);
        Assert.Equal(25, first.Items.Count);
        Assert.Equal([$"Member {tag} 25"], second!.Items.Select(p => p.Name));
    }

    private sealed record Person(Guid Id, string Name, string? HomeCity, string? PhotoUrl, HeldRole[] Roles);

    private sealed record HeldRole(Guid Id, string Name, Guid? ChapterId);

    private sealed record PeoplePage(List<Person> Items, int Page, int PageSize, int TotalCount);
}
