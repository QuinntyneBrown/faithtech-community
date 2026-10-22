using FaithTech.Community.Application.Common;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>Moves a partner to another stage with an optional note for its history (L2-018 AC2).</summary>
public record MovePartnerCommand(string? To, string? Note = null);

public class MovePartnerValidator : AbstractValidator<MovePartnerCommand>
{
    public const int MaxNote = 500;

    public MovePartnerValidator()
    {
        RuleFor(x => x.To).Must(s => PartnerRules.TryParseStage(s, out _)).WithMessage("Choose Lead, In funnel or Confirmed.");
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

        PartnerRules.TryParseStage(command.To, out var to);
        if (partner.Stage == to)
        {
            return (Result.Conflict($"{partner.Name} is already at that stage."), null);
        }

        var from = partner.Stage;
        var actor = await access.CallerProfileIdAsync(cancellationToken);
        partner.MoveTo(to, actor, time.GetUtcNow().UtcDateTime, PartnerRules.Blank(command.Note));
        db.PartnerStageChanges.Add(partner.StageChanges.Last());
        access.AuditAdminWrite(actor, partner, "partner.moved", new { Stage = from.ToString() }, new { Stage = to.ToString(), command.Note });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.ToDtoAsync(partner, cancellationToken));
    }
}
