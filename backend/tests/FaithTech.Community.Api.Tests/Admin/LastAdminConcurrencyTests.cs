// Traces to: L2-009; L2-139 AC1, AC2
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Admin;

/// <summary>Overlapping removals of the last two System Admin roles (L2-009: there is always one).</summary>
public class LastAdminConcurrencyTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Two_overlapping_removals_of_the_last_two_admins_leave_one_admin_and_refuse_the_other()
    {
        await RemoveEveryAdminAsync();
        var priya = await factory.AddMemberAsync("Priya Shah", p => p.AddRole(Role.SystemAdmin, Guid.Empty, DateTime.UtcNow));
        var samuel = await factory.AddMemberAsync("Samuel Osei", p => p.AddRole(Role.SystemAdmin, Guid.Empty, DateTime.UtcNow));
        var asPriya = factory.ClientFor(priya, Role.SystemAdmin);
        var asSamuel = factory.ClientFor(samuel, Role.SystemAdmin);

        // Both requests have read what they need before either saves: either their role removals or the
        // System Admin roster that guards those removals.
        factory.SaveGate.HoldUntil(2, db =>
            db.ChangeTracker.Entries<ProfileRole>().Any(e => e.State == EntityState.Deleted)
            || db.ChangeTracker.Entries<OrganisationAdminRoster>().Any(e => e.State == EntityState.Modified));
        var responses = await Task.WhenAll(
            asPriya.DeleteAsync($"/api/profiles/{samuel.ProfileId}/roles/SystemAdmin"),
            asSamuel.DeleteAsync($"/api/profiles/{priya.ProfileId}/roles/SystemAdmin"));

        Assert.Equal(
            [HttpStatusCode.OK, HttpStatusCode.Conflict],
            responses.Select(r => r.StatusCode).Order());
        var refused = responses.Single(r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(
            "Someone else changed administrator roles at the same time. Reload and try again.",
            (await refused.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal(1, await factory.WithDbAsync(db => db.Profiles.CountAsync(p => p.Roles.Any(r => r.Definition!.Key == nameof(Role.SystemAdmin)))));

        // Only the removal that happened left an audit entry; a System Admin's role changes notify no one,
        // and the refused one added nothing.
        var targets = new[] { priya.ProfileId.ToString(), samuel.ProfileId.ToString() };
        Assert.Equal(1, await factory.WithDbAsync(db => db.AuditEntries.CountAsync(a => a.Action == "role.removed" && targets.Contains(a.TargetId))));
        Assert.Equal(0, await factory.WithDbAsync(db => db.Notifications.CountAsync(n => n.RecipientId == priya.ProfileId || n.RecipientId == samuel.ProfileId)));
    }

    [Fact]
    public async Task The_last_administrator_cannot_lose_the_role()
    {
        await RemoveEveryAdminAsync();
        var priya = await factory.AddMemberAsync("Priya Shah", p => p.AddRole(Role.SystemAdmin, Guid.Empty, DateTime.UtcNow));

        var response = await factory.ClientFor(priya, Role.SystemAdmin).DeleteAsync($"/api/profiles/{priya.ProfileId}/roles/SystemAdmin");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("There must always be at least one administrator.", (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task A_lease_left_by_a_failed_removal_expires_so_removals_are_not_blocked_for_good()
    {
        var priya = await factory.AddMemberAsync("Priya Shah", p => p.AddRole(Role.SystemAdmin, Guid.Empty, DateTime.UtcNow));
        var samuel = await factory.AddMemberAsync("Samuel Osei", p => p.AddRole(Role.SystemAdmin, Guid.Empty, DateTime.UtcNow));
        await factory.WithDbAsync(async db =>
        {
            (await db.OrganisationAdminRosters.SingleAsync()).TryTake(Guid.NewGuid(), factory.Time.GetUtcNow());
            return await db.SaveChangesAsync();
        });
        var client = factory.ClientFor(priya, Role.SystemAdmin);

        var blocked = await client.DeleteAsync($"/api/profiles/{samuel.ProfileId}/roles/SystemAdmin");
        factory.Time.Advance(OrganisationAdminRoster.LeaseLength + TimeSpan.FromSeconds(1));
        var allowed = await client.DeleteAsync($"/api/profiles/{samuel.ProfileId}/roles/SystemAdmin");

        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    // L2-139 AC1, AC2: a suspension is guarded too, so two administrators suspending each other leave one.
    [Fact]
    public async Task Two_overlapping_suspensions_of_the_last_two_admins_leave_one_admin_and_refuse_the_other()
    {
        await RemoveEveryAdminAsync();
        var priya = await factory.AddMemberAsync("Priya Shah", p => p.AddRole(Role.SystemAdmin, Guid.Empty, DateTime.UtcNow));
        var samuel = await factory.AddMemberAsync("Samuel Osei", p => p.AddRole(Role.SystemAdmin, Guid.Empty, DateTime.UtcNow));
        var asPriya = factory.ClientFor(priya, Role.SystemAdmin);
        var asSamuel = factory.ClientFor(samuel, Role.SystemAdmin);

        factory.SaveGate.HoldUntil(2, db =>
            db.ChangeTracker.Entries<Profile>().Any(e => e.State == EntityState.Modified && e.Entity.IsSuspended)
            || db.ChangeTracker.Entries<OrganisationAdminRoster>().Any(e => e.State == EntityState.Modified));
        var responses = await Task.WhenAll(
            asPriya.PostAsJsonAsync($"/api/admin/users/{samuel.ProfileId}/suspension", new { Reason = "Misuse" }),
            asSamuel.PostAsJsonAsync($"/api/admin/users/{priya.ProfileId}/suspension", new { Reason = "Misuse" }));

        Assert.Equal(
            [HttpStatusCode.NoContent, HttpStatusCode.Conflict],
            responses.Select(r => r.StatusCode).Order());
        Assert.Equal(1, await factory.WithDbAsync(db => db.Profiles.CountAsync(p => !p.IsSuspended && (p.Id == priya.ProfileId || p.Id == samuel.ProfileId))));
        Assert.Equal(1, await factory.WithDbAsync(db => db.AuditEntries.CountAsync(a => a.Action == "user.suspended" && (a.TargetId == priya.ProfileId.ToString() || a.TargetId == samuel.ProfileId.ToString()))));
    }

    private Task<int> RemoveEveryAdminAsync() => factory.WithDbAsync(async db =>
    {
        foreach (var p in await db.Profiles.Where(p => p.Roles.Any(r => r.Definition!.Key == nameof(Role.SystemAdmin))).ToListAsync())
        {
            p.RemoveRole(Role.SystemAdmin);
        }

        return await db.SaveChangesAsync();
    });
}
