using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>Per field, "keep" (the default) takes the kept record's value and "other" the other record's.</summary>
public record MergeChoices(
    string? Name = null,
    string? Stage = null,
    string? ContactName = null,
    string? Email = null,
    string? Phone = null,
    string? Website = null,
    string? Offering = null,
    string? Owner = null)
{
    public IEnumerable<string?> All => [Name, Stage, ContactName, Email, Phone, Website, Offering, Owner];
}

/// <summary>Merges OtherId into the partner in the route, with the versions the lead saw (L2-114, ADR 0028).</summary>
public record MergePartnersCommand(Guid? OtherId, int? KeepVersion, int? OtherVersion, MergeChoices? Choices = null);

public class MergePartnersValidator : AbstractValidator<MergePartnersCommand>
{
    public MergePartnersValidator()
    {
        RuleFor(x => x.OtherId).Must(id => id is { } value && value != Guid.Empty).WithMessage("Choose the partner to merge.");
        RuleFor(x => x.KeepVersion).NotNull().GreaterThanOrEqualTo(0).WithMessage("Reload the partners and try again.");
        RuleFor(x => x.OtherVersion).NotNull().GreaterThanOrEqualTo(0).WithMessage("Reload the partners and try again.");
        RuleFor(x => x.Choices)
            .Must(c => c is null || c.All.All(v => v is null or "keep" or "other"))
            .WithMessage("Choose which value to keep.");
    }
}

/// <summary>
/// Keeps one partner, takes the chosen values, joins the notes, moves both timelines and stage
/// histories into it and archives the other (L2-114, L2-115). Nothing changes until every check passes,
/// and everything is saved with its audit entry in one SaveChanges.
/// </summary>
public class MergePartnersHandler(IApplicationDbContext db, PartnerAccess access, PartnerViews views, TimeProvider time)
{
    public async Task<(Result Result, PartnerDto? Partner)> MergeAsync(Guid keepId, MergePartnersCommand command, CancellationToken cancellationToken = default)
    {
        if (!access.CanWrite)
        {
            return (Result.Forbidden(), null);
        }

        var otherId = command.OtherId!.Value;
        if (keepId == otherId)
        {
            return (Result.Invalid("OtherId", "Choose two different partners."), null);
        }

        var pair = await db.Partners.Include(p => p.StageChanges)
            .Where(p => p.Id == keepId || p.Id == otherId)
            .ToListAsync(cancellationToken);
        var kept = pair.SingleOrDefault(p => p.Id == keepId);
        var other = pair.SingleOrDefault(p => p.Id == otherId);
        if (kept is null || other is null)
        {
            return (Result.NotFound(), null);
        }

        if (pair.FirstOrDefault(p => p.IsArchived) is { } archived)
        {
            return (Result.Conflict($"{archived.Name} has already been merged."), null);
        }

        foreach (var (partner, seen) in new[] { (kept, command.KeepVersion!.Value), (other, command.OtherVersion!.Value) })
        {
            if (partner.Version != seen)
            {
                return (Stale(partner), null);
            }
        }

        var notes = JoinNotes(kept.Notes, other.Notes);
        if (notes is { Length: > PartnerRules.MaxNotes })
        {
            return (Result.Invalid("Notes", "The joined notes are longer than 2,000 characters. Shorten the notes on one partner, then merge."), null);
        }

        var before = new { Kept = Snapshot(kept), Other = Snapshot(other) };
        var choices = command.Choices ?? new MergeChoices();
        T Pick<T>(string? choice, T keep, T theirs) => choice == "other" ? theirs : keep;
        var values = new PartnerMergeValues(
            Pick(choices.Name, kept.Name, other.Name),
            Pick(choices.Stage, kept.Stage, other.Stage),
            Pick(choices.ContactName, kept.ContactName, other.ContactName),
            Pick(choices.Email, kept.Email, other.Email),
            Pick(choices.Phone, kept.Phone, other.Phone),
            Pick(choices.Website, kept.Website, other.Website),
            Pick(choices.Offering, kept.Offering, other.Offering),
            Pick(choices.Owner, kept.OwnerId, other.OwnerId));
        var fromStage = kept.Stage;
        kept.AbsorbMerge(values, notes);

        // Both timelines and both stage histories end on the kept record (AC3).
        foreach (var activity in await db.PartnerActivities.Where(a => a.PartnerId == other.Id).ToListAsync(cancellationToken))
        {
            activity.MoveTo(kept.Id);
        }

        foreach (var change in other.StageChanges.ToList())
        {
            change.MoveTo(kept.Id);
        }

        var actor = await access.CallerProfileIdAsync(cancellationToken);
        var nowUtc = time.GetUtcNow().UtcDateTime;
        var stageChanged = fromStage != kept.Stage;
        db.PartnerActivities.Add(PartnerActivity.Merged(
            kept, other, actor, nowUtc, stageChanged ? fromStage : null, stageChanged ? kept.Stage : null));
        other.ArchiveAsMergedInto(kept.Id, actor, nowUtc);
        access.Audit(actor, kept, "partners.merged", before, new
        {
            OtherId = other.Id,
            Choices = choices,
            Values = new
            {
                values.Name,
                Stage = values.Stage.ToString(),
                values.ContactName,
                values.Email,
                values.Phone,
                values.Website,
                values.Offering,
                values.OwnerId,
            },
            Notes = notes,
        });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another write got in between the version check and the save.
            return (Stale(kept), null);
        }

        return (Result.Ok(), await views.ToDtoAsync(kept, cancellationToken));
    }

    private static Result Stale(Partner partner) => Result.Conflict(
        $"Someone changed {partner.Name} while you were comparing. Nothing was changed; reload and try again.",
        new Dictionary<string, object?> { ["partnerId"] = partner.Id });

    /// <summary>The kept record's notes, a blank line, then the other's; either alone when the other is empty (AC2).</summary>
    private static string? JoinNotes(string? kept, string? other) =>
        (PartnerRules.Blank(kept), PartnerRules.Blank(other)) switch
        {
            ({ } a, { } b) => $"{a}\n\n{b}",
            ({ } a, null) => a,
            (null, { } b) => b,
            _ => null,
        };

    private static object Snapshot(Partner partner) => new
    {
        partner.Id,
        partner.Version,
        Details = ManagePartnersHandler.Snapshot(partner),
    };
}
