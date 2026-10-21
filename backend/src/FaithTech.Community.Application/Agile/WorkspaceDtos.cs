namespace FaithTech.Community.Application.Agile;

/// <summary>A row on the workspaces page (L2-050).</summary>
public record WorkspaceSummaryDto(
    Guid Id,
    string Name,
    string Method,
    Guid OwnerId,
    string OwnerName,
    bool IsOwner,
    string? ActiveSprintName,
    int MemberCount,
    bool IsArchived,
    bool NeedsNewOwner);

/// <summary>A workspace member with the work assigned to them, which a removal unassigns (L2-031 AC8).</summary>
public record WorkspaceMemberDto(Guid ProfileId, string Name, IReadOnlyList<string> Roles, bool IsOwner, int AssignedStories, int AssignedTasks, bool IsYou);

/// <summary>
/// One workspace as the caller may see it. <see cref="Access"/> is Owner, Member, Admin or Staff (ADR 0011);
/// <see cref="CanEdit"/> and <see cref="CanManage"/> tell the web app which controls to show.
/// </summary>
public record WorkspaceDto(
    Guid Id,
    string Name,
    string Method,
    Guid OwnerId,
    string OwnerName,
    IReadOnlyList<WorkspaceMemberDto> Members,
    bool IsArchived,
    string Access,
    bool CanEdit,
    bool CanManage,
    bool NeedsNewOwner);

/// <summary>A profile that can join a workspace: it holds a lead or volunteer role.</summary>
public record MemberCandidateDto(Guid ProfileId, string Name, IReadOnlyList<string> Roles);
