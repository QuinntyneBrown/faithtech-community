// Traces to: L2-017, L2-042
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Partners.PartnerClients;

namespace FaithTech.Community.Api.Tests.Partners;

public class ManagePartnersTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_lead_adds_a_partner_with_its_details_and_it_appears_at_the_lead_stage()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p => p.AddRole(Role.CityLead, Guid.Empty, DateTime.UtcNow));
        var client = factory.ClientFor(grace, Role.CityLead);
        var name = $"Kestrel Labs {Guid.NewGuid():N}";

        var response = await client.PostAsJsonAsync("/api/partners", NewPartner(name, ownerId: grace.ProfileId, email: "nadia@kestrel.example"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var partner = (await response.Content.ReadFromJsonAsync<Partner>())!;
        Assert.Equal(
            (name, "kestrel.example", "Venue for Builders Night", (Guid?)grace.ProfileId, "Grace Okonkwo", "Nadia Petrov", "nadia@kestrel.example", "416-555-0199", "Studio of 12 developers.", "Lead", true),
            (partner.Name, partner.Website, partner.Offering, partner.OwnerId, partner.OwnerName, partner.ContactName, partner.Email, partner.Phone, partner.Notes, partner.Stage, partner.CanEdit));
        var board = (await client.GetFromJsonAsync<Board>("/api/partners"))!;
        Assert.Contains(board.Columns.Single(c => c.Stage == "Lead").Cards, c => c.Id == partner.Id && c.ContactName == "Nadia Petrov");
    }

    [Fact]
    public async Task A_partner_can_start_at_another_stage()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var partner = await factory.CreatePartnerAsync(grace, "Lantern Foundation", "InFunnel");

        Assert.Equal("InFunnel", partner.Stage);
    }

    [Fact]
    public async Task A_partner_without_a_name_with_a_bad_email_or_an_unknown_stage_is_rejected()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead)
            .PostAsJsonAsync("/api/partners", NewPartner(" ", stage: "Signed", email: "nadia@"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors;
        Assert.Equal(["Enter the organisation’s name."], errors["Name"]);
        Assert.Equal(["Enter an email like name@example.org, or leave it empty."], errors["Email"]);
        Assert.Equal(["Choose Lead, In funnel or Confirmed."], errors["Stage"]);
    }

    [Fact]
    public async Task The_owner_must_be_a_member_with_a_lead_role()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var volunteer = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));

        var response = await factory.ClientFor(grace, Role.CityLead)
            .PostAsJsonAsync("/api/partners", NewPartner("Kestrel Labs", ownerId: volunteer.ProfileId));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(["Choose a lead as the owner."], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["OwnerId"]);
    }

    [Theory]
    [InlineData(Role.EventLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task Every_lead_staff_and_system_admin_see_the_same_shared_partner(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Trinity Community Centre");
        var client = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), role);

        var read = await client.GetFromJsonAsync<Partner>($"/api/partners/{partner.Id}");
        var board = await client.GetFromJsonAsync<Board>("/api/partners");

        Assert.Equal(("Trinity Community Centre", "Nadia Petrov"), (read!.Name, read.ContactName));
        Assert.Contains(board!.Columns.SelectMany(c => c.Cards), c => c.Id == partner.Id);
        Assert.Equal(role != Role.Staff, read.CanEdit);
        Assert.Equal(role != Role.Staff, board.CanEdit);
    }

    [Fact]
    public async Task Staff_cannot_create_or_edit_partners()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Summit Cloud");
        var staff = factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), Role.Staff);

        var create = await staff.PostAsJsonAsync("/api/partners", NewPartner("Northgate Credit Union"));
        var edit = await staff.PutAsJsonAsync($"/api/partners/{partner.Id}", NewPartner("Changed"));

        Assert.Equal((HttpStatusCode.Forbidden, HttpStatusCode.Forbidden), (create.StatusCode, edit.StatusCode));
        Assert.Equal("Summit Cloud", (await staff.GetFromJsonAsync<Partner>($"/api/partners/{partner.Id}"))!.Name);
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.ProductEngineer)]
    [InlineData(Role.Attendee)]
    public async Task Anyone_without_a_lead_role_staff_or_system_admin_gets_403(params Role[] roles)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Oakridge Bible College");
        var client = factory.ClientFor(await factory.AddMemberAsync("Jonah Bell"), roles);

        var statuses = new[]
        {
            (await client.GetAsync("/api/partners")).StatusCode,
            (await client.GetAsync($"/api/partners/{partner.Id}")).StatusCode,
            (await client.GetAsync("/api/partners/owners")).StatusCode,
            (await client.PostAsJsonAsync("/api/partners", NewPartner("Mine"))).StatusCode,
        };

        Assert.All(statuses, s => Assert.Equal(HttpStatusCode.Forbidden, s));
    }

    [Fact]
    public async Task An_unknown_partner_is_404()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(grace, Role.CityLead).GetAsync($"/api/partners/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Editing_changes_the_details_but_not_the_stage()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs", "InFunnel");

        var response = await factory.ClientFor(grace, Role.EventLead).PutAsJsonAsync($"/api/partners/{partner.Id}", new
        {
            Name = "Kestrel Labs Inc.",
            Website = "",
            Offering = "Venue and catering",
            ContactName = "Nadia Petrov",
            Stage = "Confirmed",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var edited = (await response.Content.ReadFromJsonAsync<Partner>())!;
        Assert.Equal(("Kestrel Labs Inc.", (string?)null, "Venue and catering", "InFunnel"), (edited.Name, edited.Website, edited.Offering, edited.Stage));
    }

    [Fact]
    public async Task The_owner_list_offers_members_with_a_lead_role()
    {
        var grace = await factory.AddMemberAsync($"Grace {Guid.NewGuid():N}", p => p.AddRole(Role.CityLead, Guid.Empty, DateTime.UtcNow));
        var hannah = await factory.AddMemberAsync($"Hannah {Guid.NewGuid():N}", p => p.AddRole(Role.CommunicationsLead, Guid.Empty, DateTime.UtcNow));
        var ruth = await factory.AddMemberAsync($"Ruth {Guid.NewGuid():N}", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));

        var owners = (await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<Owner[]>("/api/partners/owners"))!;

        Assert.Contains(owners, o => o.ProfileId == grace.ProfileId);
        Assert.Contains(owners, o => o.ProfileId == hannah.ProfileId);
        Assert.DoesNotContain(owners, o => o.ProfileId == ruth.ProfileId);
        Assert.Equal(owners.OrderBy(o => o.Name, StringComparer.CurrentCultureIgnoreCase).Select(o => o.Name), owners.Select(o => o.Name));
    }

    [Fact]
    public async Task A_system_admin_without_a_lead_role_changing_a_partner_is_audited()
    {
        var admin = await factory.AddMemberAsync("Priya Shah");
        var client = factory.ClientFor(admin, Role.SystemAdmin);

        var response = await client.PostAsJsonAsync("/api/partners", NewPartner("Pine & Co. Legal"));
        var partner = (await response.Content.ReadFromJsonAsync<Partner>())!;
        await client.PutAsJsonAsync($"/api/partners/{partner.Id}", NewPartner("Pine & Co. Legal LLP"));

        var actions = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(e => e.TargetId == partner.Id.ToString()).Select(e => e.Action).ToListAsync());
        Assert.Equal(["partner.created", "partner.updated"], actions.Order());
    }
}
