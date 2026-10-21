using FaithTech.Community.Domain.Invites;

namespace FaithTech.Community.Application.Invites;

/// <summary>An invite on the invites page (L2-010 AC4).</summary>
public record InviteDto(
    Guid Id,
    string Email,
    string? PreassignedRole,
    string Status,
    string InvitedByName,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? AcceptedAt,
    DateTimeOffset? RevokedAt)
{
    public static InviteDto From(Invite invite, string invitedByName, DateTimeOffset now) => new(
        invite.Id,
        invite.Email,
        invite.PreassignedRole?.ToString(),
        invite.Status(now).ToString(),
        invitedByName,
        invite.CreatedAt,
        invite.ExpiresAt,
        invite.AcceptedAt,
        invite.RevokedAt);
}
