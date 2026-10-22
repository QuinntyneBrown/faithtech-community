// Traces to: L2-055, L2-056, L2-060, L2-066
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Resources;

public class ResourceVisibilityTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly Dictionary<string, string> Private = new() { ["visibility"] = "Private" };

    [Fact]
    public async Task A_private_resource_is_hidden_from_everyone_but_its_owner_and_system_admin()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var budget = await factory.AddFileAsync(grace, new Upload("budget.pdf", Pdf), Private);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Esther Nakamura"), Role.Staff);
        var lead = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead);

        foreach (var other in new[] { staff, lead })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/resources/{budget.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/resources/{budget.Id}/file")).StatusCode);
            Assert.DoesNotContain((await other.ListResourcesAsync()).Items, r => r.Id == budget.Id);
        }

        var own = factory.ClientFor(grace);
        Assert.Equal(HttpStatusCode.OK, (await own.GetAsync($"/api/resources/{budget.Id}")).StatusCode);
        Assert.Contains((await own.ListResourcesAsync()).Items, r => r.Id == budget.Id);
    }

    [Fact]
    public async Task A_system_admin_opening_or_downloading_someone_elses_private_resource_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var budget = await factory.AddFileAsync(grace, new Upload("budget.pdf", Pdf), Private);
        var priya = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientFor(priya, Role.SystemAdmin);

        var page = await admin.GetFromJsonAsync<Detail>($"/api/resources/{budget.Id}");
        var download = await admin.GetAsync($"/api/resources/{budget.Id}/file");

        Assert.True(page!.CanEdit && page.CanTransfer && !page.IsOwn);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        var actions = await factory.WithDbAsync(db => db.AuditEntries
            .Where(e => e.ActorId == priya.ProfileId && e.TargetId == budget.Id.ToString()).Select(e => e.Action).ToListAsync());
        Assert.Equal(["resource.downloaded", "resource.opened"], actions.Order());
    }

    [Fact]
    public async Task A_global_resource_is_listed_for_every_signed_in_member_with_its_owner()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var volunteer = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"), Role.Volunteer);

        var row = (await volunteer.ListResourcesAsync()).Items.Single(r => r.Id == deck.Id);

        Assert.Equal(("Grace Okonkwo", false, "Global", false), (row.OwnerName, row.IsOwn, row.Visibility, row.SharedWithYou));
        var page = (await volunteer.GetFromJsonAsync<Detail>($"/api/resources/{deck.Id}"))!;
        Assert.False(page.CanEdit || page.CanTransfer);
    }

    [Fact]
    public async Task A_resource_that_does_not_exist_is_404()
    {
        var member = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"));

        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync($"/api/resources/{Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task A_suspended_owners_resources_stay_visible()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        await factory.WithDbAsync(async db =>
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == grace.ProfileId);
            profile.Suspend("Left the team.", DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });
        var member = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"));

        Assert.Equal(HttpStatusCode.OK, (await member.GetAsync($"/api/resources/{deck.Id}")).StatusCode);
    }
}
