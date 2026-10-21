// Traces to: L2-006, L2-030, L2-039
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Domain.Profiles;

public class ProfileTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void A_profile_needs_a_name(string name)
    {
        Assert.Throws<ArgumentException>(() => new Profile(name));
    }

    [Fact]
    public void Updating_changes_the_name_home_city_and_bio()
    {
        var profile = new Profile("Ada");

        profile.Update("Ada Lovelace", "London", "Builds analytical engines.");

        Assert.Equal(("Ada Lovelace", "London", "Builds analytical engines."), (profile.Name, profile.HomeCity, profile.Bio));
    }

    [Fact]
    public void Updating_with_an_empty_name_is_rejected_and_nothing_changes()
    {
        var profile = new Profile("Ada");

        Assert.Throws<ArgumentException>(() => profile.Update(" ", "London", null));
        Assert.Equal(("Ada", (string?)null), (profile.Name, profile.HomeCity));
    }

    [Fact]
    public void Suspending_records_the_reason_and_time()
    {
        var profile = new Profile("Ada");

        profile.Suspend("Spam", Now);

        Assert.Equal((true, "Spam", (DateTime?)Now), (profile.IsSuspended, profile.SuspendedReason, profile.SuspendedAtUtc));
    }

    [Fact]
    public void Suspending_needs_a_reason()
    {
        Assert.Throws<ArgumentException>(() => new Profile("Ada").Suspend("", Now));
    }

    [Fact]
    public void Suspending_a_suspended_profile_is_rejected()
    {
        var profile = new Profile("Ada");
        profile.Suspend("Spam", Now);

        Assert.Throws<InvalidOperationException>(() => profile.Suspend("Again", Now));
    }

    [Fact]
    public void Reinstating_clears_the_suspension()
    {
        var profile = new Profile("Ada");
        profile.Suspend("Spam", Now);

        profile.Reinstate();

        Assert.Equal((false, (string?)null, (DateTime?)null), (profile.IsSuspended, profile.SuspendedReason, profile.SuspendedAtUtc));
    }

    [Fact]
    public void Reinstating_a_profile_that_is_not_suspended_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => new Profile("Ada").Reinstate());
    }

    [Fact]
    public void Announcement_emails_are_on_until_the_member_opts_out()
    {
        var profile = new Profile("Ada");
        Assert.False(profile.AnnouncementEmailsOptedOut);

        profile.SetAnnouncementEmailOptOut(true);
        Assert.True(profile.AnnouncementEmailsOptedOut);

        profile.SetAnnouncementEmailOptOut(false);
        Assert.False(profile.AnnouncementEmailsOptedOut);
    }
}
