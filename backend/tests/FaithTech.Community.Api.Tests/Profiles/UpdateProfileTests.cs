// Traces to: L2-006, L2-041
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Profiles;

public class UpdateProfileTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Owner_changes_name_home_city_and_bio()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace).PutAsJsonAsync($"/api/profiles/{grace.ProfileId}",
            new { Name = "  Grace O. ", HomeCity = "Toronto", Bio = "City Lead for FaithTech Toronto." });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var profile = await LoadAsync(grace.ProfileId);
        Assert.Equal("Grace O.", profile.Name);
        Assert.Equal("Toronto", profile.HomeCity);
        Assert.Equal("City Lead for FaithTech Toronto.", profile.Bio);
    }

    [Fact]
    public async Task Blank_home_city_and_bio_are_cleared()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p => p.Update("Grace Okonkwo", "Toronto", "Old bio"));

        await factory.ClientFor(grace).PutAsJsonAsync($"/api/profiles/{grace.ProfileId}",
            new { Name = "Grace Okonkwo", HomeCity = " ", Bio = "" });

        var profile = await LoadAsync(grace.ProfileId);
        Assert.Null(profile.HomeCity);
        Assert.Null(profile.Bio);
    }

    [Theory]
    [InlineData("", "Name", "Enter your name as you’d like people to see it.")]
    [InlineData("   ", "Name", "Enter your name as you’d like people to see it.")]
    [InlineData(101, "Name", "Use 100 characters or fewer for your name.")]
    public async Task Invalid_name_is_rejected_and_nothing_is_saved(object name, string field, string message)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var value = name is int length ? new string('a', length) : (string)name;

        var response = await factory.ClientFor(grace).PutAsJsonAsync($"/api/profiles/{grace.ProfileId}",
            new { Name = value, HomeCity = "Austin", Bio = "" });

        var problem = await AssertValidationProblem(response);
        Assert.Equal([message], problem.Errors[field]);
        var profile = await LoadAsync(grace.ProfileId);
        Assert.Equal("Grace Okonkwo", profile.Name);
        Assert.Null(profile.HomeCity);
    }

    [Fact]
    public async Task Bio_longer_than_400_characters_is_rejected()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace).PutAsJsonAsync($"/api/profiles/{grace.ProfileId}",
            new { Name = "Grace Okonkwo", Bio = new string('b', 401) });

        var problem = await AssertValidationProblem(response);
        Assert.Equal(["Use 400 characters or fewer for your bio."], problem.Errors["Bio"]);
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.CityLead)]
    public async Task Anyone_but_the_owner_or_a_system_admin_gets_403(params Role[] roles)
    {
        var samuel = await factory.AddMemberAsync("Samuel Mensah");
        var other = await factory.AddMemberAsync("Daniel Reyes");

        var response = await factory.ClientFor(other, roles).PutAsJsonAsync($"/api/profiles/{samuel.ProfileId}",
            new { Name = "Changed" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("Samuel Mensah", (await LoadAsync(samuel.ProfileId)).Name);
    }

    [Fact]
    public async Task System_admin_edit_of_another_profile_succeeds_and_is_audited()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var samuel = await factory.AddMemberAsync("Samuel Mensah", p => p.Update("Samuel Mensah", "Toronto", null));

        var response = await factory.ClientFor(priya, Role.SystemAdmin).PutAsJsonAsync(
            $"/api/profiles/{samuel.ProfileId}", new { Name = "Samuel K. Mensah", HomeCity = "Toronto" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("Samuel K. Mensah", (await LoadAsync(samuel.ProfileId)).Name);
        Assert.Equal("Priya Shah", (await LoadAsync(priya.ProfileId)).Name);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == samuel.ProfileId.ToString()));
        Assert.Equal(priya.ProfileId, entry.ActorId);
        Assert.Equal("profile.updated", entry.Action);
        Assert.Equal("Profile", entry.TargetType);
        Assert.Equal("Samuel Mensah", JsonDocument.Parse(entry.BeforeJson!).RootElement.GetProperty("Name").GetString());
        Assert.Equal("Samuel K. Mensah", JsonDocument.Parse(entry.AfterJson!).RootElement.GetProperty("Name").GetString());
        Assert.Equal(DateTimeKind.Utc, entry.OccurredAtUtc.Kind);
        Assert.False(string.IsNullOrEmpty(entry.IpAddress));
    }

    [Fact]
    public async Task System_admin_editing_their_own_profile_is_not_audited()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");

        await factory.ClientFor(priya, Role.SystemAdmin).PutAsJsonAsync($"/api/profiles/{priya.ProfileId}", new { Name = "Priya S." });

        Assert.False(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.TargetId == priya.ProfileId.ToString())));
    }

    [Fact]
    public async Task Unknown_profile_is_403_to_a_member_and_404_to_a_system_admin()
    {
        var member = await factory.AddMemberAsync("Jonah Bell");
        var unknown = $"/api/profiles/{Guid.NewGuid()}";

        var asMember = await factory.ClientFor(member).PutAsJsonAsync(unknown, new { Name = "X" });
        var asAdmin = await factory.ClientFor(member, Role.SystemAdmin).PutAsJsonAsync(unknown, new { Name = "X" });

        Assert.Equal(HttpStatusCode.Forbidden, asMember.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, asAdmin.StatusCode);
    }

    private Task<Profile> LoadAsync(Guid id) =>
        factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == id));

    private static async Task<ValidationProblemDetails> AssertValidationProblem(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
    }
}
