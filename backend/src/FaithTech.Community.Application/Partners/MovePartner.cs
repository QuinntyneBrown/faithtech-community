using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>Moves a partner to another stage, named by its key, with an optional note for its history (L2-018 AC2, L2-144 AC4).</summary>
public record MovePartnerCommand(string? To, string? Note = null);

public class MovePartnerValidator : AbstractValidator<MovePartnerCommand>
{
    public const int MaxNote = 500;

    public MovePartnerValidator()
    {
        RuleFor(x => x.To).Must(s => !string.IsNullOrWhiteSpace(s)).WithMessage("Choose a stage from the list.");
        RuleFor(x => x.Note)
            .Must(n => (n?.Trim().Length ?? 0) <= MaxNote).WithMessage($"Use {MaxNote} characters or fewer for the note.");
    }
}

/// <summary>Drag, the Move to dialog and the keyboard path all send this one command (L2-018 AC2, AC3).</summary>
public class MovePartnerHandler(IApplicationDbContext db, PartnerAccess access, PartnerViews views, TimeProvider time)
{
    public async Task<(Result Result, PartnerDto? Partner)> MoveAsync(Guid id, MovePartnerCommand command, CancellationToken cancellationToken = default)
    {
        if (!access.CanWrite)
        {
            return (Result.Forbidden(), null);
        }

        var partner = await db.Partners.Include(p => p.StageChanges).SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (partner is null)
        {
            return (Result.NotFound(), null);
        }

        if (partner.IsArchived)
        {
            return (await access.ArchivedConflictAsync(partner, "Move it there.", cancellationToken), null);
        }

        // An unknown or archived stage is refused; an archived stage keeps no partners (L2-144 AC4).
        if (await db.ActiveAsync(command.To, cancellationToken) is not { } to)
        {
            return (Result.Invalid("To", "Choose a stage from the list."), null);
        }

        if (partner.StageId == to.Id)
        {
            return (Result.Conflict($"{partner.Name} is already at that stage."), null);
        }

        var from = partner.Stage!.Key;
        var actor = await access.CallerProfileIdAsync(cancellationToken);
        partner.MoveTo(to, actor, time.GetUtcNow().UtcDateTime, PartnerRules.Blank(command.Note));
        var change = partner.StageChanges.Last();
        db.PartnerStageChanges.Add(change);
        db.PartnerActivities.Add(PartnerActivity.StageMoved(change));
        access.AuditAdminWrite(actor, partner, "partner.moved", new { Stage = from }, new { Stage = to.Key, command.Note });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.ToDtoAsync(partner, cancellationToken));
    }
}
