// Traces to: L2-040
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Admin;

public class AdminUsersTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task System_admin_searches_all_users_by_name_or_email_and_sees_roles_and_status()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var tag = Guid.NewGuid().ToString("N")[..8];
        var active = await factory.AddMemberAsync($"Grace {tag}", p => p.AddRole(Role.CityLead, Guid.Empty, DateTime.UtcNow));
        var suspended = await factory.AddMemberAsync($"Victor {tag}", p => p.Suspend("Spam", DateTime.UtcNow));
        var unverified = await factory.AddMemberAsync($"Leah {tag}");
        await factory.WithDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Id == unverified.UserId)).EmailConfirmed = false;
            return await db.SaveChangesAsync();
        });

        var page = await factory.ClientFor(priya, Role.SystemAdmin).GetFromJsonAsync<Page>($"/api/admin/users?q={tag.ToUpperInvariant()}");

        Assert.Equal(3, page!.TotalCount);
        Assert.Equal(25, page.PageSize);
        Assert.Equal([$"Grace {tag}", $"Leah {tag}", $"Victor {tag}"], page.Items.Select(u => u.Name));
        var grace = page.Items[0];
        Assert.Equal(active.ProfileId, grace.Id);
        Assert.Equal(["CityLead"], grace.Roles);
        Assert.Equal("Active", grace.Status);
        Assert.Equal("Unverified", page.Items[1].Status);
        Assert.Equal("Suspended", page.Items[2].Status);
        Assert.Equal(suspended.ProfileId, page.Items[2].Id);

        var email = await factory.WithDbAsync(db => db.Users.Where(u => u.Id == active.UserId).Select(u => u.Email!).SingleAsync());
        var byEmail = await factory.ClientFor(priya, Role.SystemAdmin).GetFromJsonAsync<Page>($"/api/admin/users?q={email[..10]}");
        Assert.Equal([active.ProfileId], byEmail!.Items.Select(u => u.Id));
        Assert.Equal(email, byEmail.Items[0].Email);
    }

    [Fact]
    public async Task Without_a_term_every_user_is_listed_25_at_a_time()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        for (var i = 0; i < 26; i++)
        {
            await factory.AddMemberAsync($"Member {i:00}");
        }

        var client = factory.ClientFor(priya, Role.SystemAdmin);
        var first = await client.GetFromJsonAsync<Page>("/api/admin/users");
        var second = await client.GetFromJsonAsync<Page>("/api/admin/users?page=2");

        Assert.True(first!.TotalCount >= 27);
        Assert.Equal(25, first.Items.Count);
        Assert.NotEmpty(second!.Items);
        Assert.Empty(first.Items.Select(u => u.Id).Intersect(second.Items.Select(u => u.Id)));
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.CityLead)]
    public async Task Anyone_but_a_system_admin_gets_403(params Role[] roles)
    {
        var member = await factory.AddMemberAsync("Daniel Reyes");

        var response = await factory.ClientFor(member, roles).GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private sealed record User(Guid Id, string Name, string Email, string[] Roles, string Status);

    private sealed record Page(List<User> Items, int PageSize, int TotalCount);
}
