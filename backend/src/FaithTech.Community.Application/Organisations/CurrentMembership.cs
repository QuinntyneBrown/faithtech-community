using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// The caller's membership of the current organisation: the profile their account holds there and its current roles,
/// read on every request (L2-042 AC4). Absent when the caller holds no profile there, or only a suspended one (L2-132).
/// </summary>
public sealed record CurrentMembership(Guid ProfileId, IReadOnlyCollection<Role> Roles);
