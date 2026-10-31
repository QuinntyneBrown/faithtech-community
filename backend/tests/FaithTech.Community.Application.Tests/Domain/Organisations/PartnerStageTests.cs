// Traces to: L2-144 AC2, AC4, AC6
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Partners;

namespace FaithTech.Community.Application.Tests.Domain.Organisations;

public class PartnerStageTests
{
    private static readonly DateTime Now = new(2026, 11, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void A_stage_is_renamed_reordered_marked_initial_and_given_a_kind()
    {
        var stage = new PartnerStage(Guid.NewGuid(), "pitched", "Pitched", 2);

        stage.Rename("  Pitched to  ");
        stage.MoveTo(5);
        stage.MarkInitial(true);
        stage.SetKind(PartnerStageKind.Confirmed);

        Assert.Equal(("pitched", "Pitched to", 5, true, PartnerStageKind.Confirmed), (stage.Key, stage.Name, stage.SortOrder, stage.IsInitial, stage.Kind));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("A name that is far longer than forty characters")]
    public void A_name_is_required_and_at_most_40_characters(string name)
    {
        Assert.Throws<ArgumentException>(() => new PartnerStage(Guid.NewGuid(), "x", name, 1));
    }

    [Fact]
    public void An_archived_stage_is_no_longer_initial()
    {
        var stage = new PartnerStage(Guid.NewGuid(), "pitched", "Pitched", 2);

        stage.Archive(Now);

        Assert.True(stage.IsArchived);
        Assert.False(stage.IsInitial);
    }

    [Fact]
    public void A_move_records_the_stage_keys_and_refuses_an_archived_stage()
    {
        var partner = new Partner("Kestrel Labs", null, null, null, null, null, null, null, TestStages.Lead);
        var archived = new PartnerStage(Guid.NewGuid(), "pitched", "Pitched", 4);
        archived.Archive(Now);

        partner.MoveTo(TestStages.InFunnel, Guid.NewGuid(), Now, null);

        var change = Assert.Single(partner.StageChanges);
        Assert.Equal(("lead", "in-funnel"), (change.From, change.To));
        Assert.Equal(TestStages.InFunnel.Id, partner.StageId);
        Assert.Throws<InvalidOperationException>(() => partner.MoveTo(archived, Guid.NewGuid(), Now, null));
    }
}
