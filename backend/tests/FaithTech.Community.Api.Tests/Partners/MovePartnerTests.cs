// Traces to: L2-018, L2-017
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Partners.PartnerClients;

namespace FaithTech.Community.Api.Tests.Partners;

public class MovePartnerTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_board_has_the_three_stages_in_order_with_counts()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await factory.CreatePartnerAsync(grace, "Maple Street Church");

        var board = (await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<Board>("/api/partners"))!;

        Assert.Equal(["Lead", "InFunnel", "Confirmed"], board.Columns.Select(c => c.Stage));
        Assert.All(board.Columns, c => Assert.Equal(c.Cards.Length, c.Count));
    }

    [Fact]
    public async Task A_lead_moves_a_partner_and_the_move_is_recorded_with_who_when_and_the_note()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs", "InFunnel");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var movedAt = factory.Time.GetUtcNow().UtcDateTime;

        var response = await factory.ClientFor(marcus, Role.EventLead)
            .PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "Confirmed", Note = " Contract signed. " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var moved = (await response.Content.ReadFromJsonAsync<Partner>())!;
        Assert.Equal("Confirmed", moved.Stage);
        var change = (await factory.ClientFor(grace, Role.CityLead).ActivitiesAsync(partner.Id, "?kind=Stage")).Items
            .Single(a => a.Kind == "StageMoved");
        Assert.Equal(
            ("InFunnel", "Confirmed", marcus.ProfileId, "Marcus Lee", movedAt, "Contract signed."),
            (change.FromStage, change.ToStage, change.LoggedById, change.LoggedByName, change.LoggedAtUtc, change.Summary));
        var board = (await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<Board>("/api/partners"))!;
        Assert.Contains(board.Columns.Single(c => c.Stage == "Confirmed").Cards, c => c.Id == partner.Id);
    }

    [Fact]
    public async Task Any_stage_can_move_to_any_other_and_the_moves_are_newest_first()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Summit Cloud");
        var client = factory.ClientFor(grace, Role.CityLead);

        await client.PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "Confirmed" });
        factory.Time.Advance(TimeSpan.FromMinutes(5));
        var response = await client.PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "Lead" });

        Assert.Equal("Lead", (await response.Content.ReadFromJsonAsync<Partner>())!.Stage);
        var moves = (await client.ActivitiesAsync(partner.Id, "?kind=Stage")).Items.Where(a => a.Kind == "StageMoved").ToList();
        Assert.Equal(["Confirmed→Lead", "Lead→Confirmed"], moves.Select(h => $"{h.FromStage}→{h.ToStage}"));
        Assert.Null(moves[0].Summary);
    }

    [Fact]
    public async Task Moving_to_the_current_stage_is_a_conflict_and_records_nothing()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Summit Cloud");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "Lead" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(0, await factory.WithDbAsync(db => db.Partners.Where(p => p.Id == partner.Id).SelectMany(p => p.StageChanges).CountAsync()));
    }

    [Theory]
    [InlineData("Signed")]
    [InlineData(null)]
    public async Task An_unknown_stage_is_rejected(string? stage)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Summit Cloud");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = stage });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    public async Task Staff_and_members_without_a_lead_role_cannot_move_partners(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Summit Cloud");

        var response = await factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), role)
            .PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "Confirmed" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Moving_an_unknown_partner_is_404()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync($"/api/partners/{Guid.NewGuid()}/stage", new { To = "Confirmed" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_system_admin_without_a_lead_role_moving_a_partner_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Summit Cloud");

        await factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin)
            .PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "Confirmed" });

        Assert.True(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(e => e.TargetId == partner.Id.ToString() && e.Action == "partner.moved")));
    }
}
