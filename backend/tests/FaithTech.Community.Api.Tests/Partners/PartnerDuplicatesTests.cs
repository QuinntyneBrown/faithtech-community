// Traces to: L2-113 (docs/detailed-designs/partners/duplicate-detection-and-merge, ADR 0027)
//
// Given two partners whose website hosts are equal after normalising, when a lead asks for the
// duplicates of either, then the other is a match by website with who added it and when (AC1, AC4).
// Given two partners whose names are equal after normalising, then they match by name (AC2).
// Given two partners that share only the contact email's domain, then they do not match (AC3).
// Given more than one match, then all are returned in name order (AC5).
// Given a lead or System Admin choosing Not the same from either partner, then one dismissal is
// stored for the pair with who and when, and no lead sees the pair again (AC6).
// Given Staff, then they read the matches but dismissing answers 403; a member without a lead
// role gets 403 and an anonymous visitor 401 (AC4, AC7).
// Given a System Admin without a lead role dismissing a pair, then partner.duplicate.dismissed is
// audited; a lead's dismissal is not.
using System.Net;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Partners.PartnerClients;

namespace FaithTech.Community.Api.Tests.Partners;

public class PartnerDuplicatesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    // Every test in the fixture shares one database, so each one names its partners uniquely.
    private static string Unique() => Guid.NewGuid().ToString("N")[..8];

    [Fact]
    public async Task Partners_with_the_same_website_host_match_by_website_with_who_added_it()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var kept = await factory.AddPartnerAsync(grace, $"Kestrel {u} Labs", $"https://kestrel-{u}.example");
        var other = await factory.AddPartnerAsync(esther, $"Kestrel {u} Studio", $"www.Kestrel-{u}.example/about");

        var duplicates = await factory.ClientFor(grace, Role.CityLead).DuplicatesAsync(kept.Id);

        var match = Assert.Single(duplicates.Matches);
        Assert.Equal(
            new Duplicate(other.Id, other.Name, "Website", $"kestrel-{u}.example", "Esther Nakamura",
                DateOnly.FromDateTime(factory.Time.GetUtcNow().UtcDateTime)),
            match);
    }

    [Fact]
    public async Task Partners_with_the_same_normalised_name_match_by_name()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var kept = await factory.AddPartnerAsync(grace, $"Acme {u} Ltd.", $"acme-{u}.example");
        var other = await factory.AddPartnerAsync(grace, $"acme {u}", $"acme-{u}.org");

        var duplicates = await factory.ClientFor(grace, Role.CityLead).DuplicatesAsync(kept.Id);

        var match = Assert.Single(duplicates.Matches);
        Assert.Equal((other.Id, "Name", $"acme {u}"), (match.Id, match.Reason, match.MatchedOn));
    }

    [Fact]
    public async Task Partners_sharing_only_an_email_domain_do_not_match()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var harbour = await factory.AddPartnerAsync(grace, $"Harbour {u} Coffee", null, $"harbour{u}@gmail.com");
        await factory.AddPartnerAsync(grace, $"Northside {u} Church", null, $"northside{u}@gmail.com");

        var duplicates = await factory.ClientFor(grace, Role.CityLead).DuplicatesAsync(harbour.Id);

        Assert.Empty(duplicates.Matches);
    }

    [Fact]
    public async Task Several_matches_are_returned_in_name_order()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var kept = await factory.AddPartnerAsync(grace, $"Kestrel {u}", $"kestrel-{u}.example");
        var zed = await factory.AddPartnerAsync(grace, $"Zed {u}", $"http://kestrel-{u}.example");
        var bee = await factory.AddPartnerAsync(grace, $"kestrel {u} inc", null);

        var duplicates = await factory.ClientFor(grace, Role.CityLead).DuplicatesAsync(kept.Id);

        Assert.Equal([(bee.Id, "Name"), (zed.Id, "Website")], duplicates.Matches.Select(m => (m.Id, m.Reason)));
    }

    [Fact]
    public async Task Staff_read_the_matches_a_member_without_a_lead_role_gets_403_and_anonymous_401()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var kept = await factory.AddPartnerAsync(grace, $"Kestrel {u}", $"kestrel-{u}.example");
        await factory.AddPartnerAsync(grace, $"Kestrel {u} Inc.", null);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), Role.Staff);
        var volunteer = factory.ClientFor(await factory.AddMemberAsync("Ruth Alvarez"), Role.Volunteer);

        Assert.Single((await staff.DuplicatesAsync(kept.Id)).Matches);
        Assert.Equal(HttpStatusCode.Forbidden, (await volunteer.GetAsync($"/api/partners/{kept.Id}/duplicates")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync($"/api/partners/{kept.Id}/duplicates")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/partners/{Guid.NewGuid()}/duplicates")).StatusCode);
    }

    [Fact]
    public async Task Not_the_same_is_stored_once_for_the_pair_and_hides_it_for_every_lead()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var kept = await factory.AddPartnerAsync(grace, $"Kestrel {u}", $"kestrel-{u}.example");
        var other = await factory.AddPartnerAsync(grace, $"Kestrel {u} Inc.", null);
        var lead = factory.ClientFor(grace, Role.CityLead);

        var first = await lead.DismissDuplicateAsync(other.Id, kept.Id);
        var again = await lead.DismissDuplicateAsync(kept.Id, other.Id);

        Assert.Equal((HttpStatusCode.NoContent, HttpStatusCode.NoContent), (first.StatusCode, again.StatusCode));
        var marcusClient = factory.ClientFor(marcus, Role.EventLead);
        Assert.Empty((await marcusClient.DuplicatesAsync(kept.Id)).Matches);
        Assert.Empty((await marcusClient.DuplicatesAsync(other.Id)).Matches);
        var (low, high) = kept.Id.CompareTo(other.Id) < 0 ? (kept.Id, other.Id) : (other.Id, kept.Id);
        var dismissal = Assert.Single(await factory.WithDbAsync(db => db.PartnerDuplicateDismissals
            .Where(d => d.LowerPartnerId == low && d.HigherPartnerId == high).ToListAsync()));
        Assert.Equal(grace.ProfileId, dismissal.DismissedById);
        Assert.Equal(factory.Time.GetUtcNow().UtcDateTime, dismissal.DismissedAtUtc);
    }

    [Fact]
    public async Task A_dismissal_hides_only_that_pair()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var kept = await factory.AddPartnerAsync(grace, $"Kestrel {u}", $"kestrel-{u}.example");
        var dismissed = await factory.AddPartnerAsync(grace, $"Kestrel {u} Inc.", null);
        var still = await factory.AddPartnerAsync(grace, $"Kestrel {u} Ltd", null);
        var lead = factory.ClientFor(grace, Role.CityLead);

        await lead.DismissDuplicateAsync(kept.Id, dismissed.Id);

        Assert.Equal([still.Id], (await lead.DuplicatesAsync(kept.Id)).Matches.Select(m => m.Id));
    }

    [Fact]
    public async Task Staff_and_members_without_a_lead_role_cannot_dismiss()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var kept = await factory.AddPartnerAsync(grace, $"Kestrel {u}", $"kestrel-{u}.example");
        var other = await factory.AddPartnerAsync(grace, $"Kestrel {u} Inc.", null);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), Role.Staff);
        var volunteer = factory.ClientFor(await factory.AddMemberAsync("Ruth Alvarez"), Role.Volunteer);

        var byStaff = await staff.DismissDuplicateAsync(kept.Id, other.Id);
        var byVolunteer = await volunteer.DismissDuplicateAsync(kept.Id, other.Id);
        var anonymous = await factory.CreateClient().DismissDuplicateAsync(kept.Id, other.Id);

        Assert.Equal(
            (HttpStatusCode.Forbidden, HttpStatusCode.Forbidden, HttpStatusCode.Unauthorized),
            (byStaff.StatusCode, byVolunteer.StatusCode, anonymous.StatusCode));
        Assert.Single((await staff.DuplicatesAsync(kept.Id)).Matches);
    }

    [Fact]
    public async Task Dismissing_a_partner_against_itself_is_400_and_an_unknown_partner_404()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var kept = await factory.AddPartnerAsync(grace, $"Kestrel {u}", $"kestrel-{u}.example");
        var lead = factory.ClientFor(grace, Role.CityLead);

        Assert.Equal(HttpStatusCode.BadRequest, (await lead.DismissDuplicateAsync(kept.Id, kept.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await lead.DismissDuplicateAsync(kept.Id, Guid.NewGuid())).StatusCode);
    }

    [Fact]
    public async Task A_system_admin_without_a_lead_role_dismissing_is_audited_and_a_lead_is_not()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var kept = await factory.AddPartnerAsync(grace, $"Kestrel {u}", $"kestrel-{u}.example");
        var other = await factory.AddPartnerAsync(grace, $"Kestrel {u} Inc.", null);
        var lone = await factory.AddPartnerAsync(grace, $"Lone {u}", $"lone-{u}.example");
        var loneTwin = await factory.AddPartnerAsync(grace, $"Lone {u} LLC", null);
        var priya = await factory.AddMemberAsync("Priya Shah");

        var response = await factory.ClientFor(priya, Role.SystemAdmin).DismissDuplicateAsync(kept.Id, other.Id);
        await factory.ClientFor(grace, Role.CityLead).DismissDuplicateAsync(lone.Id, loneTwin.Id);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var entry = Assert.Single(await factory.WithDbAsync(db => db.AuditEntries
            .Where(e => e.TargetId == kept.Id.ToString() && e.Action == "partner.duplicate.dismissed").ToListAsync()));
        Assert.Equal((priya.ProfileId, "Partner"), (entry.ActorId, entry.TargetType));
        Assert.Contains(other.Id.ToString(), entry.AfterJson);
        Assert.False(await factory.WithDbAsync(db => db.AuditEntries
            .AnyAsync(e => e.TargetId == lone.Id.ToString() && e.Action == "partner.duplicate.dismissed")));
    }
}
