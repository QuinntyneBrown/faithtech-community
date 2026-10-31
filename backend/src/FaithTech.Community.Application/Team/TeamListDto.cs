namespace FaithTech.Community.Application.Team;

/// <summary>A team member as the team list shows them (L2-019): every role they hold and their featured photo.</summary>
/// <summary>A team member; `RoleBadges` reads each held role as its badge shows it, "{role} · {chapter}" when tagged (L2-141 AC3).</summary>
public record TeamMemberDto(
    Guid ProfileId, string Name, string? ChapterName, string? PhotoUrl, IReadOnlyList<string> Roles, IReadOnlyList<string> RoleBadges);

/// <summary>
/// One page of the filtered members by name; the continuation for the next page, null on the last; and how many
/// members match. The chapter filter's options come from the organisation's chapter list (L2-142 AC1).
/// </summary>
public record TeamListDto(IReadOnlyList<TeamMemberDto> Members, string? Next, int TotalCount);
