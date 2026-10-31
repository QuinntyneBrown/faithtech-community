// Traces to: L2-144 AC1, AC2, AC3, AC4, AC5, AC6, AC7; L2-152 AC1
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Partners;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Api.Tests.Reports;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Stages & types: the organisation's partner stages, and the board, history and counts that follow them.
public class PartnerStagesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Stage(
        Guid Id, string Key, string Name, int SortOrder, bool IsInitial, string Kind, bool Archived, DateTime? ArchivedAtUtc, int PartnerCount);

    private const string Stages = "/api/organisation/partner-stages";

    /// <summary>A new organisation with FaithTech's three stages and an administrator who also leads partners there.</summary>
    private async Task<(HttpClient Client, OrganisationScopes.OtherOrganisation Organisation)> FreshOrganisationAsync()
    {
        var organisation = await factory.AddOrganisationAsync($"ps-{Guid.NewGuid():N}"[..10]);
        var member = await factory.AddMemberAsync(organisation, "Grace Okonkwo", Role.SystemAdmin, Role.CityLead);
        return (factory.ClientOn(organisation, member), organisation);
    }

    private static async Task<Stage[]> ListAsync(HttpClient client, bool archived = false) =>
        (await client.GetFromJsonAsync<Stage[]>($"{Stages}{(archived ? "?archived=true" : "")}"))!;

    private static async Task<Stage> StageAsync(HttpClient client, string key) => (await ListAsync(client)).Single(s => s.Key == key);

    private static async Task<PartnerClients.Partner> AddPartnerAsync(HttpClient client, string name, string? stage = null)
    {
        var response = await client.PostAsJsonAsync("/api/partners", PartnerClients.NewPartner(name, stage));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PartnerClients.Partner>())!;
    }

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return Assert.Single((await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
    }

    private static async Task<string?> ConflictAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail;
    }

    // L2-144 AC1: the stages in order with their partner counts, which is initial and each kind.
    [Fact]
    public async Task The_stages_are_listed_in_order_with_partner_counts_the_initial_stage_and_kinds()
    {
        var (client, _) = await FreshOrganisationAsync();
        await AddPartnerAsync(client, "Kestrel Labs");
        await AddPartnerAsync(client, "Lantern Foundation", "in-funnel");

        var stages = await ListAsync(client);

        Assert.Equal(
            [("lead", "Lead", true, "Open", 1), ("in-funnel", "In Funnel", false, "Open", 1), ("confirmed", "Confirmed", false, "Confirmed", 0)],
            stages.Select(s => (s.Key, s.Name, s.IsInitial, s.Kind, s.PartnerCount)));
    }

    [Fact]
    public async Task Members_without_the_settings_capability_cannot_change_the_stages()
    {
        var volunteer = factory.ClientFor(await factory.AddMemberAsync("Esther Nakamura"), Role.Volunteer);
        var reader = factory.ClientWithCapabilities(await factory.AddMemberAsync("Marcus Lee"), Capability.ManageRoles);

        Assert.Equal(HttpStatusCode.Forbidden, (await volunteer.GetAsync(Stages)).StatusCode);
        var lead = (await ListAsync(reader)).Single(s => s.Key == "lead");
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PostAsJsonAsync(Stages, new { Name = "Pitched" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PutAsJsonAsync($"{Stages}/{lead.Id}", new { Name = "New" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PostAsync($"{Stages}/{lead.Id}/archive", null)).StatusCode);
    }

    // L2-144 AC1, AC2, AC3; L2-152 AC1: a new stage is Open, not initial, at the end, keyed from its name and audited.
    [Fact]
    public async Task An_added_stage_is_an_open_column_at_the_end_of_the_board_and_is_audited()
    {
        var (client, organisation) = await FreshOrganisationAsync();

        var response = await client.PostAsJsonAsync(Stages, new { Name = " Proposal sent " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var stage = (await response.Content.ReadFromJsonAsync<Stage>())!;
        Assert.Equal(("proposal-sent", "Proposal sent", false, "Open"), (stage.Key, stage.Name, stage.IsInitial, stage.Kind));
        var board = (await client.GetFromJsonAsync<PartnerClients.Board>("/api/partners"))!;
        Assert.Equal(["Lead", "In Funnel", "Confirmed", "Proposal sent"], board.Columns.Select(c => c.Name));
        var entry = await factory.WithDbAsync(organisation.Id, db => db.AuditEntries.OrderBy(a => a.Id).LastAsync(a => a.Action == "taxonomy.updated"));
        Assert.Contains("Proposal sent", entry.AfterJson);
    }

    // L2-144 AC2: a name is required, at most 40 characters and unique among active stages ignoring case.
    [Fact]
    public async Task A_stage_name_is_required_short_and_unique_ignoring_case()
    {
        var (client, _) = await FreshOrganisationAsync();
        var funnel = await StageAsync(client, "in-funnel");

        Assert.Equal("Enter a name.", await FieldErrorAsync(await client.PostAsJsonAsync(Stages, new { Name = "  " }), "Name"));
        Assert.Equal("Use 40 characters or fewer.", await FieldErrorAsync(await client.PostAsJsonAsync(Stages, new { Name = new string('a', 41) }), "Name"));
        Assert.Equal("There’s already a stage called lead.", await FieldErrorAsync(await client.PostAsJsonAsync(Stages, new { Name = "lead" }), "Name"));
        Assert.Equal(
            "There’s already a stage called Confirmed.",
            await FieldErrorAsync(await client.PutAsJsonAsync($"{Stages}/{funnel.Id}", new { Name = "Confirmed" }), "Name"));
    }

    // L2-144 AC2, AC3: set as initial moves the flag, and new partners start there.
    [Fact]
    public async Task Setting_the_initial_stage_moves_the_flag_and_new_partners_start_there()
    {
        var (client, _) = await FreshOrganisationAsync();
        var funnel = await StageAsync(client, "in-funnel");

        var response = await client.PutAsJsonAsync($"{Stages}/{funnel.Id}", new { IsInitial = true });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["in-funnel"], (await ListAsync(client)).Where(s => s.IsInitial).Select(s => s.Key));
        Assert.Equal("in-funnel", (await AddPartnerAsync(client, "Kestrel Labs")).Stage);
    }

    // L2-144 AC5: Confirmed counts by kind, and the pipeline has one count per active stage.
    [Fact]
    public async Task Partners_confirmed_counts_the_stages_of_kind_confirmed()
    {
        var (client, _) = await FreshOrganisationAsync();
        await AddPartnerAsync(client, "Kestrel Labs", "in-funnel");
        await AddPartnerAsync(client, "Lantern Foundation", "confirmed");
        var funnel = await StageAsync(client, "in-funnel");

        (await client.PutAsJsonAsync($"{Stages}/{funnel.Id}", new { Kind = "Confirmed" })).EnsureSuccessStatusCode();

        var report = await client.ReportAsync();
        Assert.Equal((2, 2), (report.Figures.PartnersConfirmed.Value, report.Figures.PartnersConfirmed.InPipeline));
        Assert.Equal(["Lead", "In Funnel", "Confirmed"], report.Stages);
        Assert.Equal([new ReportClients.PipelineRow("Partner pipeline", 0, 1, 1)], report.PartnerPipeline);
        var board = (await client.GetFromJsonAsync<PartnerClients.Board>("/api/partners"))!;
        Assert.Equal(["Open", "Confirmed", "Confirmed"], board.Columns.Select(c => c.Kind));
    }

    // L2-144 AC6: history shows the current name, and "(archived)" once archived.
    [Fact]
    public async Task History_shows_the_current_stage_names_and_archived_stages()
    {
        var (client, _) = await FreshOrganisationAsync();
        var partner = await AddPartnerAsync(client, "Kestrel Labs");
        (await client.PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "in-funnel" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "confirmed" })).EnsureSuccessStatusCode();
        var funnel = await StageAsync(client, "in-funnel");
        var lead = await StageAsync(client, "lead");

        (await client.PutAsJsonAsync($"{Stages}/{funnel.Id}", new { Name = "Proposal sent" })).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync($"{Stages}/{funnel.Id}", new { IsInitial = true })).EnsureSuccessStatusCode();
        (await client.PostAsync($"{Stages}/{lead.Id}/archive", null)).EnsureSuccessStatusCode();

        // The entries share a timestamp, so their order is not what is under test.
        var texts = (await client.ActivitiesAsync(partner.Id)).Items.Select(a => a.Text).Order(StringComparer.Ordinal);
        Assert.Equal(
            [
                "Added Kestrel Labs at Lead (archived)",
                "Moved Kestrel Labs from Lead (archived) to Proposal sent",
                "Moved Kestrel Labs from Proposal sent to Confirmed",
            ],
            texts);
    }

    // L2-144 AC7, AC2: a stage with partners and the initial stage stay; an empty stage is archived.
    [Fact]
    public async Task A_stage_with_partners_and_the_initial_stage_cannot_be_archived()
    {
        var (client, _) = await FreshOrganisationAsync();
        foreach (var name in new[] { "Kestrel Labs", "Lantern Foundation", "Maple Church" })
        {
            await AddPartnerAsync(client, name, "in-funnel");
        }

        var stages = (await ListAsync(client)).ToDictionary(s => s.Key);

        Assert.Equal("3 partners are on this stage. Move them first.", await ConflictAsync(await client.PostAsync($"{Stages}/{stages["in-funnel"].Id}/archive", null)));
        Assert.Equal("Choose another initial stage first.", await ConflictAsync(await client.PostAsync($"{Stages}/{stages["lead"].Id}/archive", null)));
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"{Stages}/{stages["confirmed"].Id}/archive", null)).StatusCode);
        Assert.Equal(["confirmed"], (await ListAsync(client, archived: true)).Select(s => s.Key));
        Assert.Equal(["lead", "in-funnel"], (await ListAsync(client)).Select(s => s.Key));
    }

    // L2-144 AC4: a partner left on an archived stage is listed at the end until moved; nothing moves onto it.
    [Fact]
    public async Task A_partner_on_an_archived_stage_is_in_an_archived_column_and_no_partner_moves_onto_it()
    {
        var (client, organisation) = await FreshOrganisationAsync();
        var partner = await AddPartnerAsync(client, "Kestrel Labs", "in-funnel");
        var other = await AddPartnerAsync(client, "Lantern Foundation");
        await factory.WithDbAsync(organisation.Id, async db =>
        {
            (await db.PartnerStages.SingleAsync(s => s.Key == "in-funnel")).Archive(DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });

        var board = (await client.GetFromJsonAsync<PartnerClients.Board>("/api/partners"))!;
        Assert.Equal([("Lead", false), ("Confirmed", false), ("In Funnel", true)], board.Columns.Select(c => (c.Name, c.Archived)));
        Assert.Equal([partner.Id], board.Columns[^1].Cards.Select(c => c.Id));
        var move = await client.PostAsJsonAsync($"/api/partners/{other.Id}/stage", new { To = "in-funnel" });
        Assert.Equal("Choose a stage from the list.", await FieldErrorAsync(move, "To"));
        (await client.PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "lead" })).EnsureSuccessStatusCode();
        Assert.Equal(2, (await client.GetFromJsonAsync<PartnerClients.Board>("/api/partners"))!.Columns.Length);
    }

    // L2-144 AC1: reorder lists every active stage once and the board follows.
    [Fact]
    public async Task Reordering_the_stages_reorders_the_board()
    {
        var (client, _) = await FreshOrganisationAsync();
        var ids = (await ListAsync(client)).Select(s => s.Id).ToArray();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Stages}/order", new { Ids = ids[..2] })).StatusCode);
        (await client.PutAsJsonAsync($"{Stages}/order", new { Ids = new[] { ids[2], ids[0], ids[1] } })).EnsureSuccessStatusCode();

        var board = (await client.GetFromJsonAsync<PartnerClients.Board>("/api/partners"))!;
        Assert.Equal(["confirmed", "lead", "in-funnel"], board.Columns.Select(c => c.Stage));
    }

    public sealed record StageOption(Guid Id, string Key, string Name, bool IsInitial, string Kind);

    public sealed record OrganisationView(StageOption[] PartnerStages);

    // L2-144 AC3, AC4: every member's pickers read the active stages in order from the organisation.
    [Fact]
    public async Task The_organisation_offers_its_active_stages_in_order_to_every_member()
    {
        var (client, organisation) = await FreshOrganisationAsync();
        var confirmed = await StageAsync(client, "confirmed");
        (await client.PostAsync($"{Stages}/{confirmed.Id}/archive", null)).EnsureSuccessStatusCode();
        var member = factory.ClientOn(organisation, await factory.AddMemberAsync(organisation, "Ruth Alvarez"));

        var view = (await member.GetFromJsonAsync<OrganisationView>("/api/organisation"))!;

        Assert.Equal([("lead", "Lead", true, "Open"), ("in-funnel", "In Funnel", false, "Open")], view.PartnerStages.Select(s => (s.Key, s.Name, s.IsInitial, s.Kind)));
    }

    // ADR 0032: another organisation's stage is not found.
    [Fact]
    public async Task Another_organisations_stage_is_not_found()
    {
        var (client, _) = await FreshOrganisationAsync();
        var (otherClient, _) = await FreshOrganisationAsync();
        var theirs = await StageAsync(otherClient, "confirmed");

        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"{Stages}/{theirs.Id}", new { Name = "Signed" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"{Stages}/{theirs.Id}/archive", null)).StatusCode);
    }
}
