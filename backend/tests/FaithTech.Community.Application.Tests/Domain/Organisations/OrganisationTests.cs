// Traces to: L2-130, L2-131 AC3, L2-147, L2-150
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Tests.Domain.Organisations;

public class OrganisationTests
{
    private static readonly DateTime Now = new(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc);

    private static Organisation Northside() =>
        new(Guid.NewGuid(), "northside", "app.northside.church", "Northside Church", "Northside", Now);

    [Fact]
    public void A_new_organisation_is_active_with_no_chapters()
    {
        var organisation = Northside();

        Assert.Equal(OrganisationStatus.Active, organisation.Status);
        Assert.Null(organisation.ChapterLabelSingular);
        Assert.Null(organisation.ChapterLabelPlural);
        Assert.Equal(Now, organisation.CreatedAtUtc);
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("Northside")]
    [InlineData("north side")]
    [InlineData("-northside")]
    [InlineData("")]
    public void A_slug_is_3_to_40_lower_case_letters_digits_and_hyphens(string slug)
    {
        Assert.Throws<ArgumentException>(() => new Organisation(Guid.NewGuid(), slug, "app.northside.church", "Northside Church", "Northside", Now));
    }

    [Fact]
    public void A_host_is_stored_in_lower_case()
    {
        var organisation = new Organisation(Guid.NewGuid(), "northside", "App.Northside.Church", "Northside Church", "Northside", Now);

        Assert.Equal("app.northside.church", organisation.Host);
    }

    [Fact]
    public void Rename_trims_and_keeps_both_names()
    {
        var organisation = Northside();

        organisation.Rename("  Northside Community Church ", " Northside CC ");

        Assert.Equal("Northside Community Church", organisation.Name);
        Assert.Equal("Northside CC", organisation.ShortName);
    }

    [Theory]
    [InlineData("", "Northside")]
    [InlineData("Northside Church", " ")]
    public void Rename_needs_both_names(string name, string shortName)
    {
        var organisation = Northside();

        Assert.Throws<ArgumentException>(() => organisation.Rename(name, shortName));
        Assert.Equal("Northside Church", organisation.Name);
    }

    [Fact]
    public void Rename_limits_the_name_to_100_and_the_short_name_to_30_characters()
    {
        var organisation = Northside();

        Assert.Throws<ArgumentException>(() => organisation.Rename(new string('a', 101), "Northside"));
        Assert.Throws<ArgumentException>(() => organisation.Rename("Northside Church", new string('a', 31)));
        organisation.Rename(new string('a', 100), new string('b', 30));
    }

    [Fact]
    public void Set_chapter_label_turns_chapters_on_and_off()
    {
        var organisation = Northside();

        organisation.SetChapterLabel(" Campus ", " Campuses ");
        Assert.Equal(("Campus", "Campuses"), (organisation.ChapterLabelSingular, organisation.ChapterLabelPlural));

        organisation.SetChapterLabel(null, null);
        Assert.Equal((null, null), (organisation.ChapterLabelSingular, organisation.ChapterLabelPlural));
    }

    [Theory]
    [InlineData("Campus", null)]
    [InlineData(null, "Campuses")]
    [InlineData("Campus", " ")]
    public void A_chapter_label_needs_both_forms(string? singular, string? plural)
    {
        var organisation = Northside();

        Assert.Throws<ArgumentException>(() => organisation.SetChapterLabel(singular, plural));
    }

    [Fact]
    public void Suspend_records_the_reason_and_lift_clears_it()
    {
        var organisation = Northside();

        organisation.Suspend("Unpaid invoice", Now);
        Assert.Equal(OrganisationStatus.Suspended, organisation.Status);
        Assert.Equal("Unpaid invoice", organisation.SuspendedReason);
        Assert.Equal(Now, organisation.SuspendedAtUtc);

        organisation.Lift();
        Assert.Equal(OrganisationStatus.Active, organisation.Status);
        Assert.Null(organisation.SuspendedReason);
        Assert.Null(organisation.SuspendedAtUtc);
    }

    [Fact]
    public void A_suspended_organisation_cannot_be_suspended_again()
    {
        var organisation = Northside();
        organisation.Suspend("Unpaid invoice", Now);

        Assert.Throws<InvalidOperationException>(() => organisation.Suspend("Again", Now));
    }

    [Fact]
    public void An_active_organisation_cannot_be_lifted()
    {
        Assert.Throws<InvalidOperationException>(() => Northside().Lift());
    }

    [Fact]
    public void A_suspension_needs_a_reason()
    {
        Assert.Throws<ArgumentException>(() => Northside().Suspend(" ", Now));
    }
}
