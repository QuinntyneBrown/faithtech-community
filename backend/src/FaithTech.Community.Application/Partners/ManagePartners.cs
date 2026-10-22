using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Partners;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>A partner's details (L2-017). Stage applies on create only; an edit never changes it.</summary>
public record PartnerCommand(
    string? Name,
    string? Website,
    string? Offering,
    Guid? OwnerId,
    string? ContactName,
    string? Email,
    string? Phone,
    string? Notes,
    string? Stage = null);

public static class PartnerRules
{
    public const int MaxField = 200;
    public const int MaxNotes = 2000;

    public static bool TryParseStage(string? value, out PartnerStage stage) =>
        Enum.TryParse(value, ignoreCase: false, out stage) && Enum.IsDefined(stage);

    public static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public class PartnerValidator : AbstractValidator<PartnerCommand>
{
    public PartnerValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Enter the organisation’s name.")
            .Must(n => n!.Trim().Length <= PartnerRules.MaxField).WithMessage($"Use {PartnerRules.MaxField} characters or fewer for the name.");
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email)).WithMessage("Enter an email like name@example.org, or leave it empty.")
            .Must(e => (e?.Trim().Length ?? 0) <= 256).WithMessage("Enter an email like name@example.org, or leave it empty.");
        RuleFor(x => x.Website).Must(Short).WithMessage($"Use {PartnerRules.MaxField} characters or fewer for the website.");
        RuleFor(x => x.Offering).Must(Short).WithMessage($"Use {PartnerRules.MaxField} characters or fewer for what they could offer.");
        RuleFor(x => x.ContactName).Must(Short).WithMessage($"Use {PartnerRules.MaxField} characters or fewer for the main contact.");
        RuleFor(x => x.Phone).Must(Short).WithMessage($"Use {PartnerRules.MaxField} characters or fewer for the phone.");
        RuleFor(x => x.Notes)
            .Must(n => (n?.Trim().Length ?? 0) <= PartnerRules.MaxNotes).WithMessage($"Use {PartnerRules.MaxNotes} characters or fewer for the notes.");
        RuleFor(x => x.Stage)
            .Must(s => PartnerRules.TryParseStage(s, out _)).When(x => !string.IsNullOrEmpty(x.Stage))
            .WithMessage("Choose Lead, In funnel or Confirmed.");
    }

    private static bool Short(string? value) => (value?.Trim().Length ?? 0) <= PartnerRules.MaxField;
}

/// <summary>Creates, reads and edits partners in the shared pipeline (L2-017).</summary>
public class ManagePartnersHandler(IApplicationDbContext db, PartnerAccess access, PartnerViews views, TimeProvider time)
{
    public async Task<(Result Result, PartnerDto? Partner)> CreateAsync(PartnerCommand command, CancellationToken cancellationToken = default)
    {
        if (!access.CanWrite)
        {
            return (Result.Forbidden(), null);
        }

        if (await OwnerErrorAsync(command.OwnerId, cancellationToken) is { } invalid)
        {
            return (invalid, null);
        }

        var stage = PartnerRules.TryParseStage(command.Stage, out var chosen) ? chosen : PartnerStage.Lead;
        var partner = new Partner(
            command.Name!.Trim(),
            PartnerRules.Blank(command.Website),
            PartnerRules.Blank(command.Offering),
            command.OwnerId,
            PartnerRules.Blank(command.ContactName),
            PartnerRules.Blank(command.Email),
            PartnerRules.Blank(command.Phone),
            PartnerRules.Blank(command.Notes),
            stage);
        db.Partners.Add(partner);
        var actor = await access.CallerProfileIdAsync(cancellationToken);
        db.PartnerActivities.Add(PartnerActivity.Added(partner, actor, time.GetUtcNow().UtcDateTime));
        access.AuditAdminWrite(actor, partner, "partner.created", null, Snapshot(partner));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.ToDtoAsync(partner, cancellationToken));
    }

    public async Task<(Result Result, PartnerDto? Partner)> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!access.CanRead)
        {
            return (Result.Forbidden(), null);
        }

        var partner = await db.Partners.AsNoTracking().Include(p => p.StageChanges).SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        return partner is null ? (Result.NotFound(), null) : (Result.Ok(), await views.ToDtoAsync(partner, cancellationToken));
    }

    public async Task<(Result Result, PartnerDto? Partner)> UpdateAsync(Guid id, PartnerCommand command, CancellationToken cancellationToken = default)
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
            return (await access.ArchivedConflictAsync(partner, "Change it there.", cancellationToken), null);
        }

        if (await OwnerErrorAsync(command.OwnerId, cancellationToken) is { } invalid)
        {
            return (invalid, null);
        }

        var before = Snapshot(partner);
        partner.Update(
            command.Name!.Trim(),
            PartnerRules.Blank(command.Website),
            PartnerRules.Blank(command.Offering),
            command.OwnerId,
            PartnerRules.Blank(command.ContactName),
            PartnerRules.Blank(command.Email),
            PartnerRules.Blank(command.Phone),
            PartnerRules.Blank(command.Notes));
        access.AuditAdminWrite(await access.CallerProfileIdAsync(cancellationToken), partner, "partner.updated", before, Snapshot(partner));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.ToDtoAsync(partner, cancellationToken));
    }

    /// <summary>The board: every active partner, by stage then name, with a count per stage (L2-018 AC1, L2-089 AC4).</summary>
    public async Task<PartnerBoardDto?> BoardAsync(CancellationToken cancellationToken = default)
    {
        if (!access.CanRead)
        {
            return null;
        }

        var partners = await db.Partners.AsNoTracking()
            .Where(p => p.ArchivedAtUtc == null)
            .Select(p => new { p.Id, p.Name, p.ContactName, p.Offering, p.Stage })
            .ToListAsync(cancellationToken);
        // One query for every card's next step: the first logged activity with one per partner, in timeline order.
        var steps = (await PartnerTimelineOrder.Newest(db.PartnerActivities.AsNoTracking().Where(a => a.NextStep != null))
                .Select(a => new { a.PartnerId, a.NextStep, a.NextStepDue })
                .ToListAsync(cancellationToken))
            .GroupBy(a => a.PartnerId)
            .ToDictionary(g => g.Key, g => g.First());
        var columns = Enum.GetValues<PartnerStage>()
            .Select(stage =>
            {
                var cards = partners.Where(p => p.Stage == stage)
                    .OrderBy(p => p.Name, StringComparer.CurrentCultureIgnoreCase)
                    .Select(p => steps.TryGetValue(p.Id, out var step)
                        ? new PartnerCardDto(p.Id, p.Name, p.ContactName, p.Offering, step.NextStep, step.NextStepDue)
                        : new PartnerCardDto(p.Id, p.Name, p.ContactName, p.Offering))
                    .ToList();
                return new PartnerColumnDto(stage.ToString(), cards.Count, cards);
            })
            .ToList();
        return new PartnerBoardDto(columns, access.CanWrite);
    }

    /// <summary>Members holding a lead role, by name: the people a partner can be owned by.</summary>
    public async Task<IReadOnlyList<PartnerOwnerDto>?> OwnersAsync(CancellationToken cancellationToken = default)
    {
        if (!access.CanRead)
        {
            return null;
        }

        var owners = await db.Profiles.AsNoTracking()
            .Where(p => p.Roles.Any(r => LeadRoles.All.Contains(r.Role)))
            .Select(p => new PartnerOwnerDto(p.Id, p.Name))
            .ToListAsync(cancellationToken);
        return [.. owners.OrderBy(o => o.Name, StringComparer.CurrentCultureIgnoreCase)];
    }

    private async Task<Result?> OwnerErrorAsync(Guid? ownerId, CancellationToken cancellationToken)
    {
        if (ownerId is not { } owner)
        {
            return null;
        }

        var isLead = await db.Profiles.AnyAsync(p => p.Id == owner && p.Roles.Any(r => LeadRoles.All.Contains(r.Role)), cancellationToken);
        return isLead ? null : Result.Invalid("OwnerId", "Choose a lead as the owner.");
    }

    internal static object Snapshot(Partner p) =>
        new { p.Name, p.Website, p.Offering, p.OwnerId, p.ContactName, p.Email, p.Phone, p.Notes, Stage = p.Stage.ToString() };
}
