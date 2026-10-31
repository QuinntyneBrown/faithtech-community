namespace FaithTech.Community.Application.Organisations;

/// <summary>A role the caller's profile holds, by definition (ADR 0033).</summary>
public sealed record HeldRole(Guid Id, string Key, string Name);

/// <summary>
/// The caller's membership of the current organisation: the profile their account holds there, its current non-archived
/// roles and the union of their capabilities, read on every request (L2-042 AC4, L2-135 AC2). Absent when the caller
/// holds no profile there, or only a suspended one (L2-132).
/// </summary>
public sealed record CurrentMembership(Guid ProfileId, IReadOnlyList<HeldRole> Roles, IReadOnlySet<string> Capabilities);
