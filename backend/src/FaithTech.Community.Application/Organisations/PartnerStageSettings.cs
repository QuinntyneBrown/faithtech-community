using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// A partner stage as Stages &amp; types lists it (L2-144 AC1): its key, name, order, whether it is the initial stage, its
/// kind (Open or Confirmed), whether and when it was archived, and how many non-archived partners are on it.
/// </summary>
public sealed record PartnerStageDto(
    Guid Id, string Key, string Name, int SortOrder, bool IsInitial, string Kind, bool Archived, DateTime? ArchivedAtUtc, int PartnerCount);

/// <summary>An active stage as the board's move dialog and every picker offer it, from GET /api/organisation.</summary>
public sealed record PartnerStageOptionDto(Guid Id, string Key, string Name, bool IsInitial, string Kind);

/// <summary>POST /api/organisation/partner-stages: a new stage's name.</summary>
public record TaxonomyNameCommand(string? Name);

/// <summary>
/// PUT /api/organisation/partner-stages/{id}: any of a new name, "make this the initial stage" (true only) and a kind
/// (Open or Confirmed). The row menu sends one at a time; the rename dialog sends the name.
/// </summary>
public record PartnerStageCommand(string? Name = null, bool? IsInitial = null, string? Kind = null);

/// <summary>PUT /api/organisation/partner-stages/order: every active stage's id, in the new order.</summary>
public record ReorderTaxonomyCommand(Guid[]? Ids);

/// <summary>TaxonomyRules (L2-144 AC2): a trimmed name of up to 40 characters, and how a new entry's key is derived.</summary>
public static class TaxonomyRules
{
    public const int MaxName = PartnerStage.MaxName;

    public static IRuleBuilderOptions<T, string?> EntryName<T>(this IRuleBuilderInitial<T, string?> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter a name.")
            .Must(name => name!.Trim().Length <= MaxName).WithMessage($"Use {MaxName} characters or fewer.");

    /// <summary>
    /// The key for a new entry: the name lower-cased with "-" for each run of other characters, then "-2", "-3"… while
    /// the organisation already has that key. Keys never change after creation.
    /// </summary>
    public static string KeyFor(string name, IReadOnlyCollection<string> taken)
    {
        var chars = name.Trim().ToLowerInvariant().Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-').ToArray();
        var key = string.Join('-', new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
        key = key.Length == 0 ? "entry" : key[..Math.Min(key.Length, MaxName - 4)].TrimEnd('-');
        var candidate = key;
        for (var n = 2; taken.Contains(candidate, StringComparer.Ordinal); n++)
        {
            candidate = $"{key}-{n}";
        }

        return candidate;
    }
}

public class TaxonomyNameValidator : AbstractValidator<TaxonomyNameCommand>
{
    public TaxonomyNameValidator() => RuleFor(x => x.Name).EntryName();
}

public class PartnerStageValidator : AbstractValidator<PartnerStageCommand>
{
    public PartnerStageValidator()
    {
        RuleFor(x => x.Name).EntryName().When(x => x.Name is not null);
        RuleFor(x => x.IsInitial).Equal(true).When(x => x.IsInitial is not null).WithMessage("Choose another initial stage instead.");
        RuleFor(x => x.Kind).Must(k => Enum.TryParse<PartnerStageKind>(k, ignoreCase: false, out _)).When(x => x.Kind is not null)
            .WithMessage("Choose Open or Confirmed.");
    }
}

/// <summary>
/// The organisation's partner stages on Stages &amp; types (L2-144 AC1, AC2, AC7): listed for a holder of
/// ManageOrganisationSettings, or read-only with ManageRoles as the other settings tabs are (L2-147); added, renamed,
/// reordered, made initial, given a kind and archived by a holder of ManageOrganisationSettings, each audited as
/// taxonomy.updated in the same unit of work (L2-152 AC1).
/// </summary>
public class ManagePartnerStagesHandler(IApplicationDbContext db, ICurrentUser current, IAuditLog audit, TimeProvider time)
{
    public const string List = "partner-stages";

    public async Task<(Result Result, IReadOnlyList<PartnerStageDto>? Stages)> ListAsync(bool archived, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageOrganisationSettings) && !current.Has(Capability.ManageRoles))
        {
            return (Result.Forbidden(), null);
        }

        var stages = await db.PartnerStages.Where(s => (s.ArchivedAtUtc != null) == archived)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name).ToListAsync(cancellationToken);
        var counts = await CountsAsync(cancellationToken);
        return (Result.Ok(), [.. stages.Select(s => Dto(s, counts))]);
    }

    public async Task<(Result Result, PartnerStageDto? Stage)> AddAsync(TaxonomyNameCommand command, CancellationToken cancellationToken = default)
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

        var stages = await db.PartnerStages.ToListAsync(cancellationToken);
        var last = stages.Where(s => !s.IsArchived).Select(s => (int?)s.SortOrder).Max();
        var stage = new PartnerStage(Guid.NewGuid(), TaxonomyRules.KeyFor(name, [.. stages.Select(s => s.Key)]), name, (last ?? 0) + 1);
        db.PartnerStages.Add(stage);
        Audit(stage.Id, null, Snapshot(stage));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Dto(stage, new Dictionary<Guid, int>()));
    }

    /// <summary>Renames, makes initial (moving the flag in one save) or sets the kind of an active stage.</summary>
    public async Task<(Result Result, PartnerStageDto? Stage)> UpdateAsync(
        Guid id, PartnerStageCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var stages = await db.PartnerStages.Where(s => s.ArchivedAtUtc == null).ToListAsync(cancellationToken);
        if (stages.SingleOrDefault(s => s.Id == id) is not { } stage)
        {
            return (Result.NotFound(), null);
        }

        var before = Snapshot(stage);
        if (command.Name is { } rename)
        {
            var name = rename.Trim();
            if (await TakenAsync(name, id, cancellationToken) is { } taken)
            {
                return (taken, null);
            }

            stage.Rename(name);
        }

        if (command.IsInitial is true)
        {
            foreach (var other in stages)
            {
                other.MarkInitial(other.Id == id);
            }
        }

        if (command.Kind is { } kind)
        {
            stage.SetKind(Enum.Parse<PartnerStageKind>(kind));
        }

        Audit(id, before, Snapshot(stage));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Dto(stage, await CountsAsync(cancellationToken)));
    }

    public async Task<(Result Result, IReadOnlyList<PartnerStageDto>? Stages)> ReorderAsync(
        ReorderTaxonomyCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var stages = await db.PartnerStages.Where(s => s.ArchivedAtUtc == null).ToListAsync(cancellationToken);
        var ids = command.Ids ?? [];
        if (ids.Length != stages.Count || ids.Distinct().Count() != ids.Length || ids.Any(id => stages.All(s => s.Id != id)))
        {
            return (Result.Invalid(nameof(ReorderTaxonomyCommand.Ids), "List every active stage once."), null);
        }

        var before = stages.OrderBy(s => s.SortOrder).Select(s => s.Key).ToList();
        for (var i = 0; i < ids.Length; i++)
        {
            stages.Single(s => s.Id == ids[i]).MoveTo(i + 1);
        }

        var ordered = stages.OrderBy(s => s.SortOrder).ToList();
        audit.Record(current.Membership!.ProfileId, "taxonomy.updated", "Taxonomy", List,
            new { List, Order = before }, new { List, Order = ordered.Select(s => s.Key) });
        await db.SaveChangesAsync(cancellationToken);
        var counts = await CountsAsync(cancellationToken);
        return (Result.Ok(), [.. ordered.Select(s => Dto(s, counts))]);
    }

    /// <summary>
    /// Archives an active stage that holds no partners, is not the initial stage and is not the last active stage
    /// (L2-144 AC2, AC7); each refusal is a 409 the archive dialog shows.
    /// </summary>
    public async Task<(Result Result, PartnerStageDto? Stage)> ArchiveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var stages = await db.PartnerStages.Where(s => s.ArchivedAtUtc == null).ToListAsync(cancellationToken);
        if (stages.SingleOrDefault(s => s.Id == id) is not { } stage)
        {
            return (Result.NotFound(), null);
        }

        var partners = await db.Partners.CountAsync(p => p.StageId == id && p.ArchivedAtUtc == null, cancellationToken);
        if (partners > 0)
        {
            return (Result.Conflict(partners == 1
                ? "1 partner is on this stage. Move it first."
                : $"{partners} partners are on this stage. Move them first."), null);
        }

        if (stages.Count == 1)
        {
            return (Result.Conflict("Keep at least one stage. Add another stage first."), null);
        }

        if (stage.IsInitial)
        {
            return (Result.Conflict("Choose another initial stage first."), null);
        }

        var before = Snapshot(stage);
        stage.Archive(time.GetUtcNow().UtcDateTime);
        Audit(id, before, Snapshot(stage));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Dto(stage, new Dictionary<Guid, int>()));
    }

    private Result? Refusal() =>
        !current.Has(Capability.ManageOrganisationSettings) || current.Membership is null ? Result.Forbidden() : null;

    private async Task<Result?> TakenAsync(string name, Guid? except, CancellationToken cancellationToken)
    {
        var lower = name.ToLowerInvariant();
        var taken = await db.PartnerStages.AnyAsync(
            s => s.ArchivedAtUtc == null && s.Id != except && s.Name.ToLower() == lower, cancellationToken);
        return taken ? Result.Invalid("Name", $"There’s already a stage called {name}.") : null;
    }

    private Task<Dictionary<Guid, int>> CountsAsync(CancellationToken cancellationToken) =>
        db.Partners.Where(p => p.ArchivedAtUtc == null)
            .GroupBy(p => p.StageId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, cancellationToken);

    private void Audit(Guid id, object? before, object after) =>
        audit.Record(current.Membership!.ProfileId, "taxonomy.updated", "PartnerStage", id.ToString(), before, after);

    private static object Snapshot(PartnerStage s) =>
        new { List, s.Key, s.Name, s.SortOrder, s.IsInitial, Kind = s.Kind.ToString(), Archived = s.IsArchived };

    private static PartnerStageDto Dto(PartnerStage s, IReadOnlyDictionary<Guid, int> counts) =>
        new(s.Id, s.Key, s.Name, s.SortOrder, s.IsInitial, s.Kind.ToString(), s.IsArchived, s.ArchivedAtUtc, counts.GetValueOrDefault(s.Id));
}
