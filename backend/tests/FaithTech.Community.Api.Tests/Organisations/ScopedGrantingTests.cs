// Traces to: L2-143 AC1-AC5, L2-138 AC5-AC7, L2-141 AC3
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

/// <summary>
/// A grantor whose own grantor role is tagged with chapters grants and removes chapter-scopable roles only in those
/// chapters; an untagged grantor and an administrator grant anywhere (docs/detailed-designs/organisations/chapters).
/// </summary>
public class ScopedGrantingTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public record HeldRole(Guid Id, string Name, Guid? ChapterId, string? ChapterName);

    // L2-143 AC1: a scoped grantor tags a scopable role with one of their chapters, must tag it, and can't use another.
    [Fact]
    public async Task A_scoped_grantor_grants_scopable_roles_only_in_their_chapters()
    {
        var (toronto, austin) = await ChaptersAsync();
        var grace = await GrantorAsync("Grace Okonkwo", toronto);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var inToronto = await grace.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("Volunteer"), ChapterId = toronto });
        var inAustin = await grace.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("EventLead"), ChapterId = austin });
        var untagged = await grace.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("EventLead") });

        Assert.Equal(HttpStatusCode.OK, inToronto.StatusCode);
        var held = Assert.Single((await inToronto.Content.ReadFromJsonAsync<HeldRole[]>())!);
        Assert.Equal((toronto, "Toronto"), (held.ChapterId, held.ChapterName));
        Assert.Equal(HttpStatusCode.Forbidden, inAustin.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, untagged.StatusCode);
        Assert.Equal(["ChapterId"], (await untagged.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.Keys);
    }

    // L2-143 AC1: a role that is not chapter-scopable is granted under the grant rules alone.
    [Fact]
    public async Task A_scoped_grantor_grants_a_role_that_is_not_scopable_without_a_chapter()
    {
        var (toronto, _) = await ChaptersAsync();
        var grace = await GrantorAsync("Grace Okonkwo", toronto);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var response = await grace.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("ProductEngineer") });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // L2-143 AC2: a scoped grantor can't remove an assignment tagged with another chapter, or an untagged one.
    [Fact]
    public async Task A_scoped_grantor_removes_only_assignments_in_their_chapters()
    {
        var (toronto, austin) = await ChaptersAsync();
        var grace = await GrantorAsync("Grace Okonkwo", toronto);
        var volunteer = factory.RoleIdOf("Volunteer");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p =>
        {
            p.AddRole(volunteer, Guid.Empty, DateTime.UtcNow, toronto);
            p.AddRole(volunteer, Guid.Empty, DateTime.UtcNow, austin);
            p.AddRole(volunteer, Guid.Empty, DateTime.UtcNow);
        });

        var other = await grace.DeleteAsync($"{RolesOf(ruth)}/{volunteer}?chapterId={austin}");
        var untagged = await grace.DeleteAsync($"{RolesOf(ruth)}/{volunteer}");
        var own = await grace.DeleteAsync($"{RolesOf(ruth)}/{volunteer}?chapterId={toronto}");

        Assert.Equal(HttpStatusCode.Forbidden, other.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, untagged.StatusCode);
        Assert.Equal(HttpStatusCode.OK, own.StatusCode);
        Assert.Equal([null, austin], (await own.Content.ReadFromJsonAsync<HeldRole[]>())!.Select(r => r.ChapterId).Order());
    }

    // L2-143 AC3: an untagged grantor tags any active chapter or none.
    [Fact]
    public async Task An_untagged_grantor_grants_in_any_chapter_or_none()
    {
        var (_, austin) = await ChaptersAsync();
        var grace = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), Role.CityLead);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var tagged = await grace.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("Volunteer"), ChapterId = austin });
        var untagged = await grace.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("Volunteer") });

        Assert.Equal(HttpStatusCode.OK, tagged.StatusCode);
        Assert.Equal(HttpStatusCode.OK, untagged.StatusCode);
        Assert.Equal(2, (await untagged.Content.ReadFromJsonAsync<HeldRole[]>())!.Length);
    }

    // L2-143 AC4: an administrator is never scoped, even when they also hold a tagged grantor role.
    [Fact]
    public async Task An_administrator_is_never_scoped()
    {
        var (toronto, austin) = await ChaptersAsync();
        var lee = await factory.AddMemberAsync("Lee Park", p => p.AddRole(factory.RoleIdOf("CityLead"), Guid.Empty, DateTime.UtcNow, toronto));
        var admin = factory.ClientFor(lee, Role.SystemAdmin);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var response = await admin.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("CityLead"), ChapterId = austin });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // L2-143 AC5: a grantor who holds the grantor role for several chapters grants in each.
    [Fact]
    public async Task A_grantor_for_several_chapters_grants_in_each()
    {
        var (toronto, austin) = await ChaptersAsync();
        var grace = await GrantorAsync("Grace Okonkwo", toronto, austin);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        foreach (var chapter in new[] { toronto, austin })
        {
            var response = await grace.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("Volunteer"), ChapterId = chapter });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    // L2-138 AC6: a chapter on a role that is not scopable is 400; an unknown chapter is 400 too.
    [Fact]
    public async Task A_chapter_on_a_role_that_is_not_scopable_or_an_unknown_chapter_is_400()
    {
        var (toronto, _) = await ChaptersAsync();
        var admin = factory.ClientFor(await factory.AddMemberAsync("Lee Park"), Role.SystemAdmin);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var notScopable = await admin.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("ProductEngineer"), ChapterId = toronto });
        var unknown = await admin.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("Volunteer"), ChapterId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.BadRequest, notScopable.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        Assert.Equal(["ChapterId"], (await unknown.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.Keys);
    }

    // L2-138 AC7: the same role with the same tag twice is 409; another tag is a second assignment.
    [Fact]
    public async Task The_same_role_and_tag_twice_is_409_and_another_tag_is_a_second_assignment()
    {
        var (toronto, austin) = await ChaptersAsync();
        var admin = factory.ClientFor(await factory.AddMemberAsync("Lee Park"), Role.SystemAdmin);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var volunteer = factory.RoleIdOf("Volunteer");

        await admin.PostAsJsonAsync(RolesOf(ruth), new { RoleId = volunteer, ChapterId = toronto });
        var again = await admin.PostAsJsonAsync(RolesOf(ruth), new { RoleId = volunteer, ChapterId = toronto });
        var second = await admin.PostAsJsonAsync(RolesOf(ruth), new { RoleId = volunteer, ChapterId = austin });

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
    }

    // L2-138 AC5: the audit entry records the chapter tag.
    [Fact]
    public async Task The_audit_entry_records_the_chapter_tag()
    {
        var (toronto, _) = await ChaptersAsync();
        var grace = await GrantorAsync("Grace Okonkwo", toronto);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        await grace.PostAsJsonAsync(RolesOf(ruth), new { RoleId = factory.RoleIdOf("Volunteer"), ChapterId = toronto });

        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == ruth.ProfileId.ToString()));
        Assert.Contains(toronto.ToString(), entry.AfterJson);
    }

    public record MeRole(Guid Id, Guid? ChapterId);

    public record Me(MeRole[] Roles, Guid[]? GrantChapterIds);

    // L2-133 AC1: /api/me names the chapters a scoped grantor may tag, and each held role's tag; null when unscoped.
    [Fact]
    public async Task Me_names_the_chapters_a_scoped_grantor_may_grant_in()
    {
        var (toronto, austin) = await ChaptersAsync();
        var volunteer = factory.RoleIdOf("Volunteer");
        var cityLead = factory.RoleIdOf("CityLead");
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p =>
        {
            p.AddRole(cityLead, Guid.Empty, DateTime.UtcNow, toronto);
            p.AddRole(volunteer, Guid.Empty, DateTime.UtcNow);
            p.AddRole(volunteer, Guid.Empty, DateTime.UtcNow, austin);
        });

        var scoped = await factory.ClientFor(grace).GetFromJsonAsync<Me>("/api/me");
        var untagged = await factory.ClientFor(await factory.AddMemberAsync("Lee Park"), Role.CityLead).GetFromJsonAsync<Me>("/api/me");
        var admin = await factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal([toronto], scoped!.GrantChapterIds ?? []);
        Assert.Contains(scoped.Roles, r => r.Id == cityLead && r.ChapterId == toronto);
        Assert.Contains(scoped.Roles, r => r.Id == volunteer && r.ChapterId == austin);
        Assert.Null(untagged!.GrantChapterIds);
        Assert.Null(admin!.GrantChapterIds);
    }

    private static string RolesOf(ProfileClients.Member member) => $"/api/profiles/{member.ProfileId}/roles";

    private async Task<(Guid Toronto, Guid Austin)> ChaptersAsync() =>
        ((await factory.AddChapterAsync("Toronto")).Id, (await factory.AddChapterAsync("Austin")).Id);

    /// <summary>A member holding the City Lead role tagged with each of <paramref name="chapters"/>, and their client.</summary>
    private async Task<HttpClient> GrantorAsync(string name, params Guid[] chapters)
    {
        var cityLead = factory.RoleIdOf("CityLead");
        var member = await factory.AddMemberAsync(name, p =>
        {
            foreach (var chapter in chapters)
            {
                p.AddRole(cityLead, Guid.Empty, DateTime.UtcNow, chapter);
            }
        });
        return factory.ClientFor(member);
    }
}
