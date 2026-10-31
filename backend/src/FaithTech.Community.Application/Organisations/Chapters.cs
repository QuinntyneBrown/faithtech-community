using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>A chapter as the Chapters tab lists it (L2-140 AC3). The member count joins with chapters on profiles (slice 19).</summary>
public sealed record ChapterDto(Guid Id, string Name, int SortOrder, bool Archived, int MemberCount);

/// <summary>An active chapter as every picker and filter offers it, from GET /api/organisation (L2-142 AC1).</summary>
public sealed record ChapterOptionDto(Guid Id, string Name);

/// <summary>POST /api/organisation/chapters and PUT /api/organisation/chapters/{id}.</summary>
public record ChapterNameCommand(string? Name);

/// <summary>PUT /api/organisation/chapters/order: every active chapter's id, in the new order.</summary>
public record ReorderChaptersCommand(Guid[]? ChapterIds);

/// <summary>ChapterRules (L2-140 AC4): a trimmed name of up to 60 characters. Uniqueness is the handler's check.</summary>
public class ChapterNameValidator : AbstractValidator<ChapterNameCommand>
{
    public ChapterNameValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter a name.")
            .Must(name => name!.Trim().Length <= Chapter.MaxNameLength)
            .WithMessage($"Use {Chapter.MaxNameLength} characters or fewer for the name.");
    }
}

/// <summary>
/// GET /api/organisation/chapters: the active chapters in order, or the archived ones, for the Chapters tab. Readable
/// with ManageOrganisationSettings, and read-only with ManageRoles (L2-147 AC2).
/// </summary>
public class ListChaptersHandler(IApplicationDbContext db, ICurrentUser current)
{
    public async Task<(Result Result, IReadOnlyList<ChapterDto>? Chapters)> HandleAsync(
        bool archived, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageOrganisationSettings) && !current.Has(Capability.ManageRoles))
        {
            return (Result.Forbidden(), null);
        }

        // Readable while chapters are off too, so turning them back on finds them (L2-140 AC6).
        var chapters = await db.Chapters.IgnoreQueryFilters(QueryFilters.ChaptersOnOnly)
            .Where(c => (c.ArchivedAtUtc != null) == archived)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(cancellationToken);
        var members = await Chapters.MemberCountsAsync(db, cancellationToken);
        return (Result.Ok(), [.. chapters.Select(c => Chapters.Dto(c, members.GetValueOrDefault(c.Id)))]);
    }
}

/// <summary>
/// Adds, renames, reorders and archives the host organisation's chapters for a holder of ManageOrganisationSettings
/// while chapters are on (L2-140 AC3 to AC5, AC7), each audited under chapters in the same unit of work (L2-152 AC1).
/// </summary>
public class ManageChaptersHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    ICurrentOrganisation organisation,
    IAuditLog audit,
    TimeProvider time)
{
    public const string ChaptersOffMessage = "Turn chapters on in General first.";

    public async Task<(Result Result, ChapterDto? Chapter)> AddAsync(ChapterNameCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var name = command.Name!.Trim();
        if (await TakenAsync(name, null, cancellationToken) is { } taken)
        {
            return (taken, null);
        }

        var last = await db.Chapters.Where(c => c.ArchivedAtUtc == null).MaxAsync(c => (int?)c.SortOrder, cancellationToken);
        var chapter = new Chapter(name, (last ?? -1) + 1);
        db.Chapters.Add(chapter);
        audit.Record(current.Membership!.ProfileId, "chapter.added", "Chapter", chapter.Id.ToString(), null, new { chapter.Name });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Chapters.Dto(chapter));
    }

    public async Task<(Result Result, ChapterDto? Chapter)> RenameAsync(
        Guid id, ChapterNameCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var chapter = await db.Chapters.SingleOrDefaultAsync(c => c.Id == id && c.ArchivedAtUtc == null, cancellationToken);
        if (chapter is null)
        {
            return (Result.NotFound(), null);
        }

        var name = command.Name!.Trim();
        if (await TakenAsync(name, id, cancellationToken) is { } taken)
        {
            return (taken, null);
        }

        var before = new { chapter.Name };
        chapter.Rename(name);
        audit.Record(current.Membership!.ProfileId, "chapter.updated", "Chapter", id.ToString(), before, new { chapter.Name });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Chapters.Dto(chapter));
    }

    public async Task<(Result Result, IReadOnlyList<ChapterDto>? Chapters)> ReorderAsync(
        ReorderChaptersCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var chapters = await db.Chapters.Where(c => c.ArchivedAtUtc == null).ToListAsync(cancellationToken);
        var ids = command.ChapterIds ?? [];
        if (ids.Length != chapters.Count || ids.Distinct().Count() != ids.Length || ids.Any(id => chapters.All(c => c.Id != id)))
        {
            return (Result.Invalid(nameof(ReorderChaptersCommand.ChapterIds), "List every active chapter once."), null);
        }

        var before = chapters.OrderBy(c => c.SortOrder).Select(c => c.Id).ToList();
        for (var i = 0; i < ids.Length; i++)
        {
            chapters.Single(c => c.Id == ids[i]).MoveTo(i);
        }

        audit.Record(current.Membership!.ProfileId, "chapter.reordered", "Organisation", organisation.Id.ToString(), new { Order = before }, new { Order = ids });
        await db.SaveChangesAsync(cancellationToken);
        var members = await Chapters.MemberCountsAsync(db, cancellationToken);
        return (Result.Ok(), [.. chapters.OrderBy(c => c.SortOrder).Select(c => Chapters.Dto(c, members.GetValueOrDefault(c.Id)))]);
    }

    public async Task<(Result Result, ChapterDto? Chapter)> ArchiveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var chapter = await db.Chapters.SingleOrDefaultAsync(c => c.Id == id && c.ArchivedAtUtc == null, cancellationToken);
        if (chapter is null)
        {
            return (Result.NotFound(), null);
        }

        chapter.Archive(time.GetUtcNow().UtcDateTime);
        audit.Record(current.Membership!.ProfileId, "chapter.archived", "Chapter", id.ToString(), new { chapter.Name, Archived = false }, new { chapter.Name, Archived = true });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Chapters.Dto(chapter));
    }

    private Result? Refusal() =>
        !current.Has(Capability.ManageOrganisationSettings) || current.Membership is null
            ? Result.Forbidden()
            : organisation.ChapterLabelSingular is null
                ? Result.Conflict(ChaptersOffMessage)
                : null;

    private async Task<Result?> TakenAsync(string name, Guid? except, CancellationToken cancellationToken)
    {
        var normalized = Chapter.Normalize(name);
        var taken = await db.Chapters.AnyAsync(
            c => c.ArchivedAtUtc == null && c.Id != except && c.NormalizedName == normalized, cancellationToken);
        return taken
            ? Result.Invalid(
                nameof(ChapterNameCommand.Name),
                $"There’s already a {organisation.ChapterLabelSingular!.ToLowerInvariant()} called {name}.")
            : null;
    }
}

public static class Chapters
{
    public static ChapterDto Dto(Chapter c) => Dto(c, 0);

    public static ChapterDto Dto(Chapter c, int members) => new(c.Id, c.Name, c.SortOrder, c.IsArchived, members);

    /// <summary>How many members each chapter tags, by chapter id.</summary>
    public static Task<Dictionary<Guid, int>> MemberCountsAsync(IApplicationDbContext db, CancellationToken cancellationToken) =>
        db.Profiles.Where(p => p.ChapterId != null)
            .GroupBy(p => p.ChapterId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, cancellationToken);

    /// <summary>The refusal for a chapter that is not one of the active ones, such as "Choose a city from the list."</summary>
    public static string ChooseFromList(ICurrentOrganisation organisation) =>
        $"Choose a {organisation.ChapterLabelSingular?.ToLowerInvariant() ?? "chapter"} from the list.";
}
