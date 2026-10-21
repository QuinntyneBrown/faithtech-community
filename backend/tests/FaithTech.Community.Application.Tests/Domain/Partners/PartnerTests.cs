// Traces to: L2-017, L2-018
using FaithTech.Community.Domain.Partners;

namespace FaithTech.Community.Application.Tests.Domain.Partners;

public class PartnerTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Lead = Guid.NewGuid();

    private static Partner NewPartner(PartnerStage stage = PartnerStage.Lead) =>
        new("Grace Church", "https://grace.example.org", "Venue", Lead, "Pat", "pat@grace.example.org", "555-0100", "Warm intro", stage);

    [Fact]
    public void A_new_partner_starts_at_the_lead_stage_by_default()
    {
        var partner = new Partner("Grace Church", null, null, null, null, null, null, null);

        Assert.Equal(PartnerStage.Lead, partner.Stage);
        Assert.Empty(partner.StageChanges);
    }

    [Fact]
    public void A_partner_holds_its_details_and_chosen_stage()
    {
        var partner = NewPartner(PartnerStage.InFunnel);

        Assert.Equal(
            ("Grace Church", (string?)"https://grace.example.org", (string?)"Venue", (Guid?)Lead, (string?)"Pat", (string?)"pat@grace.example.org", (string?)"555-0100", (string?)"Warm intro", PartnerStage.InFunnel),
            (partner.Name, partner.Website, partner.Offering, partner.OwnerId, partner.ContactName, partner.Email, partner.Phone, partner.Notes, partner.Stage));
    }

    [Fact]
    public void A_partner_needs_a_name()
    {
        Assert.Throws<ArgumentException>(() => new Partner("", null, null, null, null, null, null, null));
    }

    [Fact]
    public void Updating_changes_the_details_but_not_the_stage()
    {
        var partner = NewPartner(PartnerStage.Confirmed);

        partner.Update("Grace Community Church", null, "Space and volunteers", null, "Sam", null, null, null);

        Assert.Equal(
            ("Grace Community Church", (string?)"Space and volunteers", (Guid?)null, (string?)"Sam", PartnerStage.Confirmed),
            (partner.Name, partner.Offering, partner.OwnerId, partner.ContactName, partner.Stage));
    }

    [Theory]
    [InlineData(PartnerStage.Lead, PartnerStage.InFunnel)]
    [InlineData(PartnerStage.InFunnel, PartnerStage.Confirmed)]
    [InlineData(PartnerStage.Lead, PartnerStage.Confirmed)]
    [InlineData(PartnerStage.Confirmed, PartnerStage.Lead)]
    public void Moving_changes_the_stage_and_records_who_when_and_the_note(PartnerStage from, PartnerStage to)
    {
        var partner = NewPartner(from);

        partner.MoveTo(to, Lead, Now, "Signed the letter");

        Assert.Equal(to, partner.Stage);
        var change = Assert.Single(partner.StageChanges);
        Assert.Equal(
            (partner.Id, from, to, Lead, Now, (string?)"Signed the letter"),
            (change.PartnerId, change.From, change.To, change.MovedBy, change.MovedAtUtc, change.Note));
    }

    [Fact]
    public void Moving_to_the_current_stage_is_rejected()
    {
        var partner = NewPartner();

        Assert.Throws<InvalidOperationException>(() => partner.MoveTo(PartnerStage.Lead, Lead, Now, null));
        Assert.Empty(partner.StageChanges);
    }
}
