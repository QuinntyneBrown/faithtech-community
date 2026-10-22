// Traces to: L2-123 (docs/detailed-designs/reports/reports-dashboard)
using System.Net;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Reports;

public class ReportAccessTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    // L2-123 AC1: Given Staff or a System Admin, when they open the report, then it is shown.
    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task Staff_and_System_Admins_read_the_report(Role role)
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Sam Rivera"), role);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/reports")).StatusCode);
    }

    // A member who holds a lead role and Staff may read.
    [Fact]
    public async Task A_lead_who_is_also_Staff_reads_the_report()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Sam Rivera"), Role.CityLead, Role.Staff);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/reports")).StatusCode);
    }

    // L2-123 AC2: Given any other signed-in member, City Leads and the other lead roles included, when they call
    // GET /api/reports, then the server answers 403.
    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.Volunteer)]
    [InlineData(Role.ProductEngineer)]
    [InlineData(Role.Attendee)]
    public async Task Every_other_role_is_refused(Role role)
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), role);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/reports")).StatusCode);
    }

    [Fact]
    public async Task A_member_with_no_role_is_refused()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Tomás Ortega"));

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/reports?period=all-time")).StatusCode);
    }

    // L2-123 AC3: Given an anonymous visitor, when they call a report endpoint, then the response is 401.
    [Fact]
    public async Task Anonymous_visitors_get_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/reports")).StatusCode);
    }
}
