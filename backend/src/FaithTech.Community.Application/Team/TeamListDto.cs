namespace FaithTech.Community.Application.Team;

/// <summary>A team member as the team list shows them (L2-019): every role they hold and their featured photo.</summary>
public record TeamMemberDto(Guid ProfileId, string Name, string? HomeCity, string? PhotoUrl, IReadOnlyList<string> Roles);

/// <summary>The filtered members by name, and every team member's home city whatever the filters (ADR 0007).</summary>
public record TeamListDto(IReadOnlyList<TeamMemberDto> Members, IReadOnlyList<string> Cities);
