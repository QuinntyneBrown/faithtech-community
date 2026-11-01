using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>The chapter label's two forms, such as City and Cities.</summary>
public record ChapterLabelCommand(string? Singular, string? Plural);

/// <summary>PUT /api/organisation: the General settings. A null chapter label turns chapters off (L2-140 AC1, AC6).</summary>
/// <summary>The General settings; a giving link or text left out keeps its value and an empty one clears it (L2-158 AC4).</summary>
public record UpdateOrganisationCommand(
    string? Name, string? ShortName, ChapterLabelCommand? ChapterLabel = null, string? GivingLink = null, string? GivingText = null);

public class UpdateOrganisationValidator : AbstractValidator<UpdateOrganisationCommand>
{
    public UpdateOrganisationValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter a name.")
            .Must(name => name!.Trim().Length <= Organisation.MaxNameLength)
            .WithMessage($"Use {Organisation.MaxNameLength} characters or fewer for the name.");
        RuleFor(x => x.ShortName).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter a short name.")
            .Must(name => name!.Trim().Length <= Organisation.MaxShortNameLength)
            .WithMessage($"Use {Organisation.MaxShortNameLength} characters or fewer for the short name.");
        RuleFor(x => x.GivingLink)
            .Must(link => string.IsNullOrWhiteSpace(link)
                || (link.Trim().Length <= Organisation.MaxGivingLinkLength
                    && Uri.TryCreate(link.Trim(), UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps))
            .WithMessage("Use a link that starts with https://");
        RuleFor(x => x.GivingText)
            .Must(text => text is null || text.Trim().Length <= Organisation.MaxGivingTextLength)
            .WithMessage($"Use {Organisation.MaxGivingTextLength} characters or fewer for the giving text.");
        When(x => x.ChapterLabel is not null, () =>
        {
            RuleFor(x => x.ChapterLabel!.Singular).Cascade(CascadeMode.Stop)
                .Must(label => !string.IsNullOrWhiteSpace(label)).WithMessage("Enter the singular label too.")
                .Must(label => label!.Trim().Length <= Organisation.MaxChapterLabelLength)
                .WithMessage($"Use {Organisation.MaxChapterLabelLength} characters or fewer for the singular label.");
            RuleFor(x => x.ChapterLabel!.Plural).Cascade(CascadeMode.Stop)
                .Must(label => !string.IsNullOrWhiteSpace(label)).WithMessage("Enter the plural label too.")
                .Must(label => label!.Trim().Length <= Organisation.MaxChapterLabelLength)
                .WithMessage($"Use {Organisation.MaxChapterLabelLength} characters or fewer for the plural label.");
        });
    }
}

/// <summary>
/// Renames the host's organisation and sets or clears its chapter label for a holder of ManageOrganisationSettings
/// (AdministerOrganisation stands in), audited as organisation.updated with the values before and after (L2-147 AC3,
/// L2-140 AC1, AC6, L2-152 AC1). Clearing the label keeps every chapter and tag. The new names reach every
/// page, email and message on the next request, since the host is resolved from the database each time (L2-134).
/// </summary>
public class UpdateOrganisationHandler(IApplicationDbContext db, ICurrentUser current, ICurrentOrganisation organisation, IAuditLog audit)
{
    public async Task<Result> HandleAsync(UpdateOrganisationCommand command, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageOrganisationSettings) || current.Membership is not { } membership)
        {
            return Result.Forbidden();
        }

        var entity = await db.Organisations.SingleAsync(o => o.Id == organisation.Id, cancellationToken);
        var before = new { entity.Name, entity.ShortName, entity.ChapterLabelSingular, entity.ChapterLabelPlural, entity.GivingLink, entity.GivingText };
        entity.Rename(command.Name!.Trim(), command.ShortName!.Trim());
        entity.SetChapterLabel(command.ChapterLabel?.Singular?.Trim(), command.ChapterLabel?.Plural?.Trim());
        entity.SetGiving(command.GivingLink ?? entity.GivingLink, command.GivingText ?? entity.GivingText);
        audit.Record(
            membership.ProfileId, "organisation.updated", "Organisation", entity.Id.ToString(), before,
            new { entity.Name, entity.ShortName, entity.ChapterLabelSingular, entity.ChapterLabelPlural, entity.GivingLink, entity.GivingText });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
