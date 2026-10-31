using FaithTech.Community.Domain.Notes;

namespace FaithTech.Community.Application.Notes;

/// <summary>A row of the Notes list (L2-085).</summary>
public record NotePageSummaryDto(
    Guid Id,
    string Title,
    string? Icon,
    Guid OwnerId,
    string OwnerName,
    bool IsOwn,
    string Visibility,
    bool SharedWithYou,
    DateTimeOffset UpdatedAt,
    string UpdatedByName,
    string? ParentTitle);

/// <summary>A page named in a breadcrumb, a child list, backlinks or link suggestions. A page the viewer cannot open has no id and reads "Private page".</summary>
public record NotePageRefDto(Guid? Id, string Title, string? Icon);

public record NoteAudienceMemberDto(Guid Id, string Name, string? ChapterName);

public record NoteAudienceRoleDto(string Role, int Count);

public record NoteAudienceDto(IReadOnlyList<NoteAudienceMemberDto> Members, IReadOnlyList<NoteAudienceRoleDto> Roles);

/// <summary>
/// The page as the viewer sees it (L2-086 to L2-098): its blocks with page links resolved, and where it sits.
/// <c>Links</c> names the link targets the viewer may open; any other page link reads "Private page".
/// </summary>
public record NotePageDto(
    Guid Id,
    string Title,
    string? Icon,
    Guid? ParentId,
    Guid OwnerId,
    string OwnerName,
    bool IsOwn,
    string Visibility,
    bool SharedWithYou,
    string? SharedVia,
    NoteAudienceDto Audience,
    IReadOnlyList<NoteBlock> Blocks,
    int Version,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string UpdatedByName,
    DateTimeOffset? ArchivedAt,
    bool CanEdit,
    bool IsAdminView,
    IReadOnlyList<NotePageRefDto> Breadcrumb,
    IReadOnlyList<NotePageRefDto> Children,
    IReadOnlyList<NotePageRefDto> Backlinks,
    IReadOnlyList<NotePageRefDto> Links);
