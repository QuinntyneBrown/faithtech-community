// Traces to: L2-041
using FaithTech.Community.Domain.Admin;

namespace FaithTech.Community.Application.Tests.Domain.Admin;

public class AuditEntryTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void An_entry_stores_actor_action_target_before_after_time_and_ip()
    {
        var actor = Guid.NewGuid();

        var entry = new AuditEntry(actor, "role.added", "Profile", "p-1", """["Volunteer"]""", """["Volunteer","CityLead"]""", Now, "203.0.113.7");

        Assert.NotEqual(Guid.Empty, entry.Id);
        Assert.Equal(
            (actor, "role.added", "Profile", "p-1", """["Volunteer"]""", """["Volunteer","CityLead"]""", Now, "203.0.113.7"),
            (entry.ActorId, entry.Action, entry.TargetType, entry.TargetId, entry.BeforeJson, entry.AfterJson, entry.OccurredAtUtc, entry.IpAddress));
    }

    [Theory]
    [InlineData("", "Profile", "p-1")]
    [InlineData("role.added", " ", "p-1")]
    [InlineData("role.added", "Profile", "")]
    public void An_entry_needs_an_action_and_a_target(string action, string targetType, string targetId)
    {
        Assert.Throws<ArgumentException>(() => new AuditEntry(Guid.NewGuid(), action, targetType, targetId, null, null, Now, "203.0.113.7"));
    }

    [Fact]
    public void An_entry_records_its_time_in_utc()
    {
        var local = new DateTime(2026, 10, 21, 12, 0, 0, DateTimeKind.Local);

        Assert.Throws<ArgumentException>(() => new AuditEntry(Guid.NewGuid(), "role.added", "Profile", "p-1", null, null, local, "203.0.113.7"));
    }
}
