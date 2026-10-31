using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>PUT /api/organisation: the General settings. The chapter label joins it with the chapters switch (slice 18).</summary>
public record UpdateOrganisationCommand(string? Name, string? ShortName);

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
    }
}

/// <summary>
/// Renames the host's organisation for a holder of ManageOrganisationSettings (AdministerOrganisation stands in),
/// audited as organisation.updated with the names before and after (L2-147 AC3, L2-152 AC1). The new names reach every
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
        var before = new { entity.Name, entity.ShortName };
        entity.Rename(command.Name!.Trim(), command.ShortName!.Trim());
        audit.Record(
            membership.ProfileId, "organisation.updated", "Organisation", entity.Id.ToString(), before, new { entity.Name, entity.ShortName });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
