namespace FaithTech.Community.Domain.Announcements;

public class AnnouncementAudience
{
    private AnnouncementAudience() { }

    private AnnouncementAudience(AudienceKind kind, IEnumerable<Guid> roleIds, Guid? eventId)
    {
        Kind = kind;
        RoleIds = roleIds.ToHashSet();
        EventId = eventId;
    }

    public AudienceKind Kind { get; private set; }

    /// <summary>The role definitions the announcement went to, by id (ADR 0033).</summary>
    public IReadOnlySet<Guid> RoleIds { get; private set; } = new HashSet<Guid>();

    public Guid? EventId { get; private set; }

    public static AnnouncementAudience Everyone() => new(AudienceKind.Everyone, [], null);

    public static AnnouncementAudience ForRoles(params Guid[] roleIds)
    {
        if (roleIds.Length == 0)
        {
            throw new ArgumentException("A role audience needs at least one role.", nameof(roleIds));
        }

        return new(AudienceKind.Roles, roleIds, null);
    }

    public static AnnouncementAudience ForEventRsvps(Guid eventId) => new(AudienceKind.EventRsvps, [], eventId);
}
