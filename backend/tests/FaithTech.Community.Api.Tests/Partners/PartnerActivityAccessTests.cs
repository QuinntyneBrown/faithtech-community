// Traces to: L2-087 (docs/detailed-designs/partners/partner-activity-timeline)
//
// Given Staff, then they read the timeline and POST answers 403. Given a member without a lead
// role, Staff or System Admin, then both endpoints answer 403; an anonymous visitor gets 401.
// Given a System Admin without a lead role, when they log an activity, then one
// partner.activity.logged audit entry records them, the partner and the activity; a lead's own
// logging is not audited.
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Partners.PartnerClients;

namespace FaithTech.Community.Api.Tests.Partners;

public class PartnerActivityAccessTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private object Activity() => NewActivity(occurredOn: DateOnly.FromDateTime(factory.Time.GetUtcNow().UtcDateTime).ToString("yyyy-MM-dd"));

    [Fact]
    public async Task Staff_read_the_timeline_but_cannot_log()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var staff = factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), Role.Staff);

        var read = await staff.GetAsync($"/api/partners/{partner.Id}/activities");
        var log = await staff.LogActivityAsync(partner.Id, Activity());

        Assert.Equal((HttpStatusCode.OK, HttpStatusCode.Forbidden), (read.StatusCode, log.StatusCode));
        Assert.Single((await read.Content.ReadFromJsonAsync<ActivityPage>())!.Items);
    }

    [Fact]
    public async Task A_member_without_a_lead_role_gets_403_on_both_endpoints()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var volunteer = factory.ClientFor(await factory.AddMemberAsync("Ruth Alvarez"), Role.Volunteer);

        var read = await volunteer.GetAsync($"/api/partners/{partner.Id}/activities");
        var log = await volunteer.LogActivityAsync(partner.Id, Activity());

        Assert.Equal((HttpStatusCode.Forbidden, HttpStatusCode.Forbidden), (read.StatusCode, log.StatusCode));
    }

    [Fact]
    public async Task An_anonymous_visitor_gets_401_on_both_endpoints()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var anonymous = factory.CreateClient();

        var read = await anonymous.GetAsync($"/api/partners/{partner.Id}/activities");
        var log = await anonymous.LogActivityAsync(partner.Id, Activity());

        Assert.Equal((HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized), (read.StatusCode, log.StatusCode));
    }

    [Fact]
    public async Task A_system_admin_without_a_lead_role_logging_is_audited_with_the_partner_and_the_activity()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var priya = await factory.AddMemberAsync("Priya Shah");

        var response = await factory.ClientFor(priya, Role.SystemAdmin).LogActivityAsync(partner.Id, Activity());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var entry = Assert.Single(await factory.WithDbAsync(db => db.AuditEntries
            .Where(e => e.TargetId == partner.Id.ToString() && e.Action == "partner.activity.logged").ToListAsync()));
        Assert.Equal((priya.ProfileId, "Partner"), (entry.ActorId, entry.TargetType));
        Assert.Contains("Called Nadia about the contract.", entry.AfterJson);
        Assert.Contains("Call", entry.AfterJson);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.CityLead, Role.SystemAdmin)]
    public async Task A_lead_logging_is_not_audited(params Role[] roles)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");

        await factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), roles).LogActivityAsync(partner.Id, Activity());

        Assert.False(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(e => e.TargetId == partner.Id.ToString() && e.Action == "partner.activity.logged")));
    }
}
