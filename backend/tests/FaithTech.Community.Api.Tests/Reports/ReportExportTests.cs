// Traces to: L2-128 (docs/detailed-designs/reports/reports-dashboard, ADR 0030)
using System.Net;
using System.Text;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Reports.ReportClients;

namespace FaithTech.Community.Api.Tests.Reports;

public class ReportExportTests : IAsyncLifetime
{
    private CommunityApiFactory factory = null!;

    public async Task InitializeAsync() => factory = await NewFactoryAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    // L2-128 AC1: Given Staff or a System Admin, when they export, then the CSV holds the figures, both charts and both
    // tables, one section after another, for the same filters. L2-128 AC3: every value is quoted per RFC 4180 and a
    // value starting like a formula is guarded; the members context is written without a leading "+".
    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.SystemAdmin)]
    public async Task Staff_and_System_Admins_export_every_section_for_the_filters(Role role)
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Sam Staff"), role);
        var grace = await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto", joinedAt: Now.AddDays(-2));
        await factory.AddReportEventAsync("=HYPERLINK(\"x\")", Now.AddDays(-7), "Toronto", rsvps: 4, checkedIn: 3, walkIns: 1);
        await factory.AddReportEventAsync("Called off", Now.AddDays(-5), "Toronto", rsvps: 2, cancelled: true);
        await factory.AddReportPartnerAsync("Kestrel Labs", grace.ProfileId, PartnerStage.Confirmed);
        await factory.AddAnnouncementAsync(grace.ProfileId, Now.AddDays(-1));

        var response = await client.GetAsync("/api/reports/export.csv?city=Toronto&period=last-30-days");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("faithtech-report-toronto-last-30-days-2031-03-15.csv",
            response.Content.Headers.ContentDisposition?.FileNameStar ?? response.Content.Headers.ContentDisposition?.FileName);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(Encoding.UTF8.GetPreamble(), bytes[..3]);
        Assert.Equal(
            "\"Report\",\"FaithTech Community Reports\"\r\n" +
            "\"City\",\"Toronto\"\r\n" +
            "\"Period\",\"Last 30 days\"\r\n" +
            "\"From (UTC)\",\"2031-02-13 12:00\"\r\n" +
            "\"To (UTC)\",\"2031-03-15 12:00\"\r\n" +
            "\"Generated (UTC)\",\"2031-03-15 12:00\"\r\n" +
            "\r\n" +
            "\"Figures\"\r\n" +
            "\"Figure\",\"Value\",\"Context\"\r\n" +
            "\"Members\",\"1\",\"1 new in the last 30 days\"\r\n" +
            "\"Events held\",\"1\",\"1 cancelled\"\r\n" +
            "\"RSVPs\",\"4\",\"75% checked in\"\r\n" +
            "\"Partners confirmed\",\"1\",\"of 1 in the pipeline\"\r\n" +
            "\"Announcements\",\"1\",\"sent by leads\"\r\n" +
            "\r\n" +
            "\"Members by city\"\r\n" +
            "\"City\",\"Members\"\r\n" +
            "\"Toronto\",\"1\"\r\n" +
            "\r\n" +
            "\"New members by month\"\r\n" +
            "\"Month\",\"New members\"\r\n" +
            "\"Feb\",\"0\"\r\n" +
            "\"Mar (so far)\",\"1\"\r\n" +
            "\r\n" +
            "\"Partner pipeline by city\"\r\n" +
            "\"City\",\"Lead\",\"In funnel\",\"Confirmed\"\r\n" +
            "\"Toronto\",\"0\",\"0\",\"1\"\r\n" +
            "\r\n" +
            "\"Events and attendance\"\r\n" +
            "\"Event\",\"Date (UTC)\",\"City\",\"Status\",\"Going\",\"Checked in\",\"Checked in %\"\r\n" +
            "\"Called off\",\"2031-03-10 12:00\",\"Toronto\",\"Cancelled\",\"\",\"\",\"\"\r\n" +
            "\"'=HYPERLINK(\"\"x\"\")\",\"2031-03-08 12:00\",\"Toronto\",\"Held\",\"4\",\"3\",\"75\"\r\n",
            Encoding.UTF8.GetString(bytes[3..]));
    }

    [Fact]
    public async Task All_cities_name_the_file_all_cities_and_All_time_leaves_the_new_members_context_empty()
    {
        var client = await factory.StaffAsync();

        var response = await client.GetAsync("/api/reports/export.csv?period=all-time");

        Assert.Equal("faithtech-report-all-cities-all-time-2031-03-15.csv",
            response.Content.Headers.ContentDisposition?.FileNameStar ?? response.Content.Headers.ContentDisposition?.FileName);
        var csv = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"City\",\"All cities\"\r\n", csv);
        Assert.Contains("\"From (UTC)\",\"\"\r\n", csv);
        Assert.Contains("\"Members\",\"1\",\"\"\r\n", csv);
    }

    // L2-128 AC2: Given any other caller, when they request the export, then the response is 403, or 401 when
    // anonymous; an unknown filter is 400 as for the report.
    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.Volunteer)]
    public async Task Every_other_role_is_refused(Role role)
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), role);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/reports/export.csv")).StatusCode);
    }

    [Fact]
    public async Task Anonymous_is_401_and_an_unknown_filter_is_400()
    {
        var staff = await factory.StaffAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/reports/export.csv")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.GetAsync("/api/reports/export.csv?city=Atlantis")).StatusCode);
    }
}
