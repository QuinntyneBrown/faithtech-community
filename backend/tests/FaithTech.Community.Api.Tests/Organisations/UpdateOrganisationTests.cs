// Traces to: L2-147 AC3, L2-152 AC1, L2-134
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// PUT /api/organisation renames the host's organisation for a holder of ManageOrganisationSettings, audited.
public class UpdateOrganisationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record OrganisationNames(string Name, string ShortName);

    [Fact]
    public async Task A_settings_manager_renames_the_organisation_and_every_member_reads_the_new_names()
    {
        var holder = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageOrganisationSettings);
        var ruth = factory.ClientFor(await factory.AddMemberAsync("Ruth Alvarez"));

        var response = await holder.PutAsJsonAsync("/api/organisation", new { Name = "  FaithTech Global  ", ShortName = "FT Global" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new OrganisationNames("FaithTech Global", "FT Global"), await ruth.GetFromJsonAsync<OrganisationNames>("/api/organisation"));
        Assert.Equal("FT Global", (await ruth.GetFromJsonAsync<OrganisationNames>("/api/site"))!.ShortName);
    }

    [Fact]
    public async Task The_change_is_audited_with_the_names_before_and_after()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var holder = factory.ClientWithCapabilities(grace, Capability.ManageOrganisationSettings);
        await holder.PutAsJsonAsync("/api/organisation", new { Name = "Before Name", ShortName = "Before" });

        (await holder.PutAsJsonAsync("/api/organisation", new { Name = "After Name", ShortName = "After" })).EnsureSuccessStatusCode();

        var entry = await factory.WithDbAsync(db => db.AuditEntries
            .SingleAsync(a => a.Action == "organisation.updated" && a.AfterJson!.Contains("After Name")));
        Assert.Equal(grace.ProfileId, entry.ActorId);
        Assert.Equal(("Organisation", FaithTechSeed.OrganisationId.ToString()), (entry.TargetType, entry.TargetId));
        Assert.Contains("\"Name\":\"Before Name\"", entry.BeforeJson);
        Assert.Contains("\"Name\":\"After Name\"", entry.AfterJson);
        Assert.Contains("\"ShortName\":\"After\"", entry.AfterJson);
    }

    [Fact]
    public async Task An_administrator_may_rename_it_too()
    {
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);

        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/organisation", new { Name = "Admin Name", ShortName = "Admin" })).StatusCode);
    }

    [Theory]
    [InlineData]
    [InlineData(Capability.ManageRoles)]
    [InlineData(Capability.AssignRoles, Capability.ViewReports)]
    public async Task Anyone_else_gets_403_and_nothing_changes(params string[] capabilities)
    {
        var before = await factory.WithDbAsync(db => db.Organisations.Where(o => o.Id == FaithTechSeed.OrganisationId).Select(o => o.Name).SingleAsync());
        var member = factory.ClientWithCapabilities(await factory.AddMemberAsync("Leah Thompson"), capabilities);

        var response = await member.PutAsJsonAsync("/api/organisation", new { Name = "Hijacked", ShortName = "Nope" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(before, await factory.WithDbAsync(db => db.Organisations.Where(o => o.Id == FaithTechSeed.OrganisationId).Select(o => o.Name).SingleAsync()));
    }

    [Theory]
    [InlineData("", "FT", "Name", "Enter the organisation’s name.")]
    [InlineData("FaithTech", "  ", "ShortName", "Enter a short name.")]
    [InlineData("FaithTech", "A short name that is far longer than thirty", "ShortName", "Use 30 characters or fewer for the short name.")]
    public async Task A_blank_or_too_long_name_is_400_on_its_field(string name, string shortName, string field, string message)
    {
        var holder = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageOrganisationSettings);

        var response = await holder.PutAsJsonAsync("/api/organisation", new { Name = name, ShortName = shortName });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal([message], problem!.Errors[field]);
    }

    [Fact]
    public async Task A_name_over_100_characters_is_400()
    {
        var holder = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageOrganisationSettings);

        var response = await holder.PutAsJsonAsync("/api/organisation", new { Name = new string('a', 101), ShortName = "FT" });

        Assert.Equal(["Use 100 characters or fewer for the name."], (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["Name"]);
    }

    [Fact]
    public async Task Another_organisation_is_untouched()
    {
        var northside = await factory.AddOrganisationAsync("northside-rename");
        var before = await factory.WithDbAsync(northside.Id, db => db.Organisations.Where(o => o.Id == northside.Id).Select(o => o.Name).SingleAsync());
        var holder = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageOrganisationSettings);

        (await holder.PutAsJsonAsync("/api/organisation", new { Name = "Only FaithTech", ShortName = "Only" })).EnsureSuccessStatusCode();

        Assert.Equal(before, await factory.WithDbAsync(northside.Id, db => db.Organisations.Where(o => o.Id == northside.Id).Select(o => o.Name).SingleAsync()));
        Assert.False(await factory.WithDbAsync(northside.Id, db => db.AuditEntries.AnyAsync(a => a.Action == "organisation.updated")));
    }
}
