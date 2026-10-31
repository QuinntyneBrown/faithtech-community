// Traces to: L2-135 AC3, AC4, AC5
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Contacts;
using FaithTech.Community.Api.Tests.Partners;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Each rule is proven with a role defined in the test, so it holds for any organisation's roles (ADR 0033).
public class CapabilityAccessTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private HttpClient As(string name, params string[] capabilities) =>
        factory.ClientWithCapabilities(factory.AddMemberAsync(name).GetAwaiter().GetResult(), capabilities);

    [Fact]
    public async Task KeepContacts_keeps_contacts_and_without_it_the_answer_is_403()
    {
        var holder = As("Grace Okonkwo", Capability.KeepContacts);
        var other = As("Jonah Bell", Capability.ManagePartners);

        Assert.Equal(HttpStatusCode.Created, (await holder.PostAsJsonAsync("/api/contacts", ContactClients.NewContact("Tomás Ortega"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await holder.GetAsync("/api/contacts")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.GetAsync("/api/contacts")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PostAsJsonAsync("/api/contacts", ContactClients.NewContact("Tomás Ortega"))).StatusCode);
    }

    [Fact]
    public async Task Another_keeper_cannot_find_a_contact_and_an_administrator_opens_it_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        var keeper = As("Jonah Bell", Capability.KeepContacts);
        var adminMember = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientWithCapabilities(adminMember, Capability.AdministerOrganisation);

        Assert.Equal(HttpStatusCode.NotFound, (await keeper.GetAsync($"/api/contacts/{contact.Id}/notes")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/contacts/{contact.Id}/notes")).StatusCode);

        var actions = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(e => e.TargetId == contact.Id.ToString() && e.ActorId == adminMember.ProfileId).Select(e => e.Action).ToListAsync());
        Assert.Equal(["contact.notes-viewed"], actions);
    }

    [Fact]
    public async Task ViewPartners_reads_the_pipeline_and_ManagePartners_changes_it()
    {
        var viewer = As("Grace Okonkwo", Capability.ViewPartners);
        var manager = As("Jonah Bell", Capability.ManagePartners);
        var neither = As("Ruth Alvarez", Capability.KeepContacts);

        Assert.Equal(HttpStatusCode.OK, (await viewer.GetAsync("/api/partners")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsJsonAsync("/api/partners", PartnerClients.NewPartner("Kestrel Labs"))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await manager.PostAsJsonAsync("/api/partners", PartnerClients.NewPartner("Kestrel Labs"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.GetAsync("/api/partners")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await neither.GetAsync("/api/partners")).StatusCode);
    }

    [Fact]
    public async Task ViewReports_reads_reports_and_without_it_the_answer_is_403()
    {
        Assert.Equal(HttpStatusCode.OK, (await As("Grace Okonkwo", Capability.ViewReports).GetAsync("/api/reports")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await As("Jonah Bell", Capability.ManageEvents).GetAsync("/api/reports")).StatusCode);
    }
}
