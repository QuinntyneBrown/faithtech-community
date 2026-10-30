// Traces to: L2-113, L2-114, L2-115 (docs/detailed-designs/partners/duplicate-detection-and-merge, ADR 0028)
using FaithTech.Community.Domain.Partners;

namespace FaithTech.Community.Application.Tests.Domain.Partners;

public class PartnerMergeTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Lead = Guid.NewGuid();

    private static Partner NewPartner(string name = "Kestrel Labs") =>
        new(name, "kestrel.example", "Venue", Lead, "Nadia", null, null, null);

    [Fact]
    public void Every_edit_move_merge_archive_and_restore_moves_the_version_on()
    {
        var partner = NewPartner();
        var versions = new List<int> { partner.Version };

        partner.Update("Kestrel", null, null, null, null, null, null, null);
        versions.Add(partner.Version);
        partner.MoveTo(PartnerStage.Confirmed, Lead, Now, null);
        versions.Add(partner.Version);
        partner.AbsorbMerge(new PartnerMergeValues("Kestrel", PartnerStage.Lead, null, null, null, null, null, null), null);
        versions.Add(partner.Version);
        partner.ArchiveAsMergedInto(Guid.NewGuid(), Lead, Now);
        versions.Add(partner.Version);
        partner.Restore();
        versions.Add(partner.Version);
        partner.TouchForRestore();
        versions.Add(partner.Version);

        Assert.Equal(versions.Order(), versions.Distinct());
    }

    [Fact]
    public void A_merge_takes_the_values_without_recording_a_stage_change()
    {
        var partner = NewPartner();

        partner.AbsorbMerge(new PartnerMergeValues("Kestrel Labs Inc.", PartnerStage.Confirmed, "N.", "n@k.example", "555", "k.example", "Space", null), "A\n\nB");

        Assert.Equal(("Kestrel Labs Inc.", PartnerStage.Confirmed, "A\n\nB", (Guid?)null), (partner.Name, partner.Stage, partner.Notes, partner.OwnerId));
        Assert.Empty(partner.StageChanges);
    }

    [Fact]
    public void An_archived_partner_cannot_be_merged_again_or_into_itself_and_restore_clears_it()
    {
        var partner = NewPartner();
        var kept = Guid.NewGuid();

        Assert.Throws<InvalidOperationException>(() => partner.ArchiveAsMergedInto(partner.Id, Lead, Now));
        Assert.Throws<InvalidOperationException>(() => partner.Restore());
        partner.ArchiveAsMergedInto(kept, Lead, Now);
        Assert.Equal((true, kept, Lead, Now), (partner.IsArchived, partner.MergedIntoId, partner.MergedById, partner.MergedAtUtc));
        Assert.Throws<InvalidOperationException>(() => partner.ArchiveAsMergedInto(Guid.NewGuid(), Lead, Now));

        partner.Restore();

        Assert.Equal((false, (Guid?)null, (DateTime?)null), (partner.IsArchived, partner.MergedIntoId, partner.ArchivedAtUtc));
    }

    [Fact]
    public void A_moved_entry_remembers_the_record_it_was_first_written_on_through_a_chain()
    {
        var a = NewPartner("A");
        var activity = PartnerActivity.Added(a, Lead, Now);
        var b = Guid.NewGuid();
        var c = Guid.NewGuid();

        activity.MoveTo(b);
        activity.MoveTo(c);

        Assert.Equal((c, (Guid?)a.Id), (activity.PartnerId, activity.MergedFromPartnerId));
        activity.MoveBack();
        Assert.Equal((a.Id, (Guid?)null), (activity.PartnerId, activity.MergedFromPartnerId));
        Assert.Throws<InvalidOperationException>(() => activity.MoveBack());
    }

    [Fact]
    public void A_moved_stage_change_moves_back_to_its_first_record()
    {
        var a = NewPartner("A");
        a.MoveTo(PartnerStage.InFunnel, Lead, Now, null);
        var change = a.StageChanges.Single();
        var b = Guid.NewGuid();

        change.MoveTo(b);
        change.MoveBack();

        Assert.Equal((a.Id, (Guid?)null), (change.PartnerId, change.MergedFromPartnerId));
    }

    [Fact]
    public void A_dismissal_stores_the_pair_once_in_order_and_never_a_partner_with_itself()
    {
        var x = Guid.NewGuid();
        var y = Guid.NewGuid();

        var one = PartnerDuplicateDismissal.For(x, y, Lead, Now);
        var two = PartnerDuplicateDismissal.For(y, x, Lead, Now);

        Assert.Equal((one.LowerPartnerId, one.HigherPartnerId), (two.LowerPartnerId, two.HigherPartnerId));
        Assert.True(one.LowerPartnerId.CompareTo(one.HigherPartnerId) < 0);
        Assert.Throws<ArgumentException>(() => PartnerDuplicateDismissal.For(x, x, Lead, Now));
    }
}
