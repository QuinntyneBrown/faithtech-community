namespace FaithTech.Community.Domain.Profiles;

/// <summary>
/// A profile no longer holds <paramref name="Capability"/>: a role that gave it was removed, or (with definition edits) its
/// definition stopped carrying it, and no other role the profile holds still gives it (L2-139 AC3).
/// </summary>
public record CapabilityLost(Guid ProfileId, string Capability);
