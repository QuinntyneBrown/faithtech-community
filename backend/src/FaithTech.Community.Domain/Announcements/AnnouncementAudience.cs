using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Domain.Announcements;

public class AnnouncementAudience
{
    private AnnouncementAudience() { }

    private AnnouncementAudience(AudienceKind kind, IEnumerable<Role> roles, Guid? eventId)
    {
        Kind = kind;
        Roles = roles.ToHashSet();
        EventId = eventId;
    }

    public AudienceKind Kind { get; private set; }

    public IReadOnlySet<Role> Roles { get; private set; } = new HashSet<Role>();

    public Guid? EventId { get; private set; }

    public static AnnouncementAudience Everyone() => new(AudienceKind.Everyone, [], null);

    public static AnnouncementAudience ForRoles(params Role[] roles)
    {
        if (roles.Length == 0)
        {
            throw new ArgumentException("A role audience needs at least one role.", nameof(roles));
        }

        return new(AudienceKind.Roles, roles, null);
    }

    public static AnnouncementAudience ForEventRsvps(Guid eventId) => new(AudienceKind.EventRsvps, [], eventId);
}
