// Traces to: L2-017, L2-018
using FaithTech.Community.Domain.Partners;

namespace FaithTech.Community.Application.Tests.Domain.Partners;

public class PartnerTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Lead = Guid.NewGuid();

    private static Partner NewPartner(string stage = "lead") =>
        new("Grace Church", "https://grace.example.org", "Venue", Lead, "Pat", "pat@grace.example.org", "555-0100", "Warm intro", TestStages.Of(stage));

    [Fact]
    public void A_new_partner_starts_on_the_stage_it_is_given()
    {
        var partner = new Partner("Grace Church", null, null, null, null, null, null, null, TestStages.Lead);

        Assert.Equal(TestStages.Lead.Id, partner.StageId);
        Assert.Empty(partner.StageChanges);
    }

    [Fact]
    public void A_partner_holds_its_details_and_chosen_stage()
    {
        var partner = NewPartner("in-funnel");

        Assert.Equal(
            ("Grace Church", (string?)"https://grace.example.org", (string?)"Venue", (Guid?)Lead, (string?)"Pat", (string?)"pat@grace.example.org", (string?)"555-0100", (string?)"Warm intro", "in-funnel"),
            (partner.Name, partner.Website, partner.Offering, partner.OwnerId, partner.ContactName, partner.Email, partner.Phone, partner.Notes, partner.Stage!.Key));
    }

    [Fact]
    public void A_partner_needs_a_name()
    {
        Assert.Throws<ArgumentException>(() => new Partner("", null, null, null, null, null, null, null, TestStages.Lead));
    }

    [Fact]
    public void Updating_changes_the_details_but_not_the_stage()
    {
        var partner = NewPartner("confirmed");

        partner.Update("Grace Community Church", null, "Space and volunteers", null, "Sam", null, null, null);

        Assert.Equal(
            ("Grace Community Church", (string?)"Space and volunteers", (Guid?)null, (string?)"Sam", "confirmed"),
            (partner.Name, partner.Offering, partner.OwnerId, partner.ContactName, partner.Stage!.Key));
    }

    [Theory]
    [InlineData("lead", "in-funnel")]
    [InlineData("in-funnel", "confirmed")]
    [InlineData("lead", "confirmed")]
    [InlineData("confirmed", "lead")]
    public void Moving_changes_the_stage_and_records_who_when_and_the_note(string from, string to)
    {
        var partner = NewPartner(from);

        partner.MoveTo(TestStages.Of(to), Lead, Now, "Signed the letter");

        Assert.Equal(to, partner.Stage!.Key);
        var change = Assert.Single(partner.StageChanges);
        Assert.Equal(
            (partner.Id, from, to, Lead, Now, (string?)"Signed the letter"),
            (change.PartnerId, change.From, change.To, change.MovedBy, change.MovedAtUtc, change.Note));
    }

    [Fact]
    public void Moving_to_the_current_stage_is_rejected()
    {
        var partner = NewPartner();

        Assert.Throws<InvalidOperationException>(() => partner.MoveTo(TestStages.Lead, Lead, Now, null));
        Assert.Empty(partner.StageChanges);
    }
}
