namespace FaithTech.Community.Application.Team;

/// <summary>A team member as the team list shows them (L2-019): every role they hold and their featured photo.</summary>
public record TeamMemberDto(Guid ProfileId, string Name, string? HomeCity, string? PhotoUrl, IReadOnlyList<string> Roles);

/// <summary>
/// One page of the filtered members by name; every team member's home city whatever the filters and the
/// page (ADR 0007); the continuation for the next page, null on the last; and how many members match.
/// </summary>
public record TeamListDto(IReadOnlyList<TeamMemberDto> Members, IReadOnlyList<string> Cities, string? Next, int TotalCount);
