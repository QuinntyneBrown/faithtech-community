using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Profiles;

public class Profile : IOrganisationScoped
{
    public const int MaxPhotos = 10;

    private readonly List<ProfileRole> _roles = [];
    private readonly List<ProfilePhoto> _photos = [];
    private readonly List<object> _domainEvents = [];

    private Profile() { }

    /// <param name="joinedAtUtc">When the account was created; set once and never changed (Reports, ADR 0030).</param>
    public Profile(string name, DateTime? joinedAtUtc = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Id = Guid.NewGuid();
        Name = name;
        JoinedAtUtc = joinedAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid OrganisationId { get; private set; }

    /// <summary>
    /// The account this profile is the membership of (ADR 0032): an account is global and holds at most one profile per
    /// organisation. Null only for a profile no account has claimed yet.
    /// </summary>
    public Guid? UserId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public IReadOnlyCollection<ProfileRole> Roles => _roles;

    public IReadOnlyCollection<ProfilePhoto> Photos => _photos;

    /// <summary>Serializes writes to <see cref="Photos"/> across requests.</summary>
    public PhotoLease PhotoLease { get; private set; } = new();

    public string? HomeCity { get; private set; }

    public string? Bio { get; private set; }

    public bool IsSuspended { get; private set; }

    /// <summary>When the account was created; null for profiles created before Reports, which are never "new".</summary>
    public DateTime? JoinedAtUtc { get; private set; }

    public string? SuspendedReason { get; private set; }

    public DateTime? SuspendedAtUtc { get; private set; }

    public bool AnnouncementEmailsOptedOut { get; private set; }

    public IReadOnlyList<object> DomainEvents => _domainEvents;

    /// <summary>Makes this profile the account's membership of its organisation; a profile belongs to one account only.</summary>
    public void LinkAccount(Guid userId)
    {
        if (UserId is { } linked && linked != userId)
        {
            throw new InvalidOperationException("This profile already belongs to another account.");
        }

        UserId = userId;
    }

    public void Update(string name, string? homeCity, string? bio)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name;
        HomeCity = homeCity;
        Bio = bio;
    }

    public void Suspend(string reason, DateTime nowUtc)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(reason);
        if (IsSuspended)
        {
            throw new InvalidOperationException("The profile is already suspended.");
        }

        IsSuspended = true;
        SuspendedReason = reason;
        SuspendedAtUtc = nowUtc;
    }

    public void Reinstate()
    {
        if (!IsSuspended)
        {
            throw new InvalidOperationException("The profile is not suspended.");
        }

        IsSuspended = false;
        SuspendedReason = null;
        SuspendedAtUtc = null;
    }

    public void SetAnnouncementEmailOptOut(bool optedOut) => AnnouncementEmailsOptedOut = optedOut;

    public void AddPhoto(ProfilePhoto photo)
    {
        if (_photos.Count >= MaxPhotos)
        {
            throw new InvalidOperationException($"A profile holds at most {MaxPhotos} photos.");
        }

        photo.SetFeatured(_photos.Count == 0);
        _photos.Add(photo);
    }

    public void Feature(Guid photoId)
    {
        var featured = FindPhoto(photoId);
        foreach (var photo in _photos)
        {
            photo.SetFeatured(photo == featured);
        }
    }

    public void RemovePhoto(Guid photoId)
    {
        var removed = FindPhoto(photoId);
        _photos.Remove(removed);
        if (removed.IsFeatured && _photos.Count > 0)
        {
            Feature(_photos.MaxBy(p => p.UploadedAt)!.Id);
        }
    }

    public bool HasRole(Guid roleDefinitionId) => _roles.Any(r => r.RoleDefinitionId == roleDefinitionId);

    /// <summary>
    /// Whether a held, non-archived definition carries <paramref name="capability"/> itself; AdministerOrganisation does
    /// not stand in for it here. Needs the definitions loaded, as they are with the profile.
    /// </summary>
    public bool HoldsCapability(string capability) =>
        _roles.Any(r => r.Definition is { ArchivedAtUtc: null } d && d.Capabilities.Contains(capability));

    public void AddRole(RoleDefinition definition, Guid grantedBy, DateTime nowUtc)
    {
        AddRole(definition.Id, grantedBy, nowUtc);
        _roles[^1].Definition = definition;
    }

    public void AddRole(Guid roleDefinitionId, Guid grantedBy, DateTime nowUtc)
    {
        if (HasRole(roleDefinitionId))
        {
            throw new InvalidOperationException("The profile already holds that role.");
        }

        _roles.Add(new ProfileRole(Id, roleDefinitionId, grantedBy, nowUtc));
    }

    public void RemoveRole(Guid roleDefinitionId)
    {
        var held = _roles.FirstOrDefault(r => r.RoleDefinitionId == roleDefinitionId)
            ?? throw new InvalidOperationException("The profile does not hold that role.");

        _roles.Remove(held);
        // One event per capability the role gave that no remaining, non-archived role still gives (L2-139 AC3).
        if (held.Definition is { IsArchived: false } removed)
        {
            foreach (var capability in removed.Capabilities.Where(c => !_roles.Any(r => r.Definition is { IsArchived: false } d && d.Carries(c))))
            {
                _domainEvents.Add(new CapabilityLost(Id, capability));
            }
        }
    }

    public void ClearDomainEvents() => _domainEvents.Clear();

    private ProfilePhoto FindPhoto(Guid photoId) =>
        _photos.FirstOrDefault(p => p.Id == photoId)
            ?? throw new InvalidOperationException("The profile has no such photo.");
}
