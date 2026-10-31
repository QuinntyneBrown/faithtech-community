using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

/// <summary>The profile form; <c>ChapterId</c> is the home chapter, or none (L2-141 AC1).</summary>
public record UpdateProfileCommand(string? Name, Guid? ChapterId, string? Bio);

public class UpdateProfileValidator : AbstractValidator<UpdateProfileCommand>
{
    public const int MaxName = 100;
    public const int MaxBio = 400;

    public UpdateProfileValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter your name as you’d like people to see it.")
            .Must(name => name!.Trim().Length <= MaxName).WithMessage($"Use {MaxName} characters or fewer for your name.");
        RuleFor(x => x.Bio)
            .Must(bio => (bio?.Trim().Length ?? 0) <= MaxBio).WithMessage($"Use {MaxBio} characters or fewer for your bio.");
    }
}

public class UpdateProfileHandler(IApplicationDbContext db, ProfileAccess access, IAuditLog audit, ICurrentOrganisation organisation)
{
    public async Task<Result> HandleAsync(Guid profileId, UpdateProfileCommand command, CancellationToken cancellationToken = default)
    {
        var (editAccess, actor) = await access.AuthorizeEditAsync(profileId, cancellationToken);
        if (editAccess == EditAccess.Forbidden)
        {
            return Result.Forbidden();
        }

        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return Result.NotFound();
        }

        // While chapters are off the form has no picker, so the tag is kept for when they come back (L2-140 AC6).
        var chapterId = organisation.ChapterLabelSingular is null ? profile.ChapterId : command.ChapterId;
        if (chapterId is { } picked && picked != profile.ChapterId
            && !await db.Chapters.AnyAsync(c => c.Id == picked && c.ArchivedAtUtc == null, cancellationToken))
        {
            return Result.Invalid(nameof(UpdateProfileCommand.ChapterId), Chapters.ChooseFromList(organisation));
        }

        var before = new { profile.Name, profile.ChapterId, profile.Bio };
        profile.Update(command.Name!.Trim(), chapterId, Blank(command.Bio));
        if (editAccess == EditAccess.AdminOverride)
        {
            audit.Record(actor, "profile.updated", "Profile", profileId.ToString(), before, new { profile.Name, profile.ChapterId, profile.Bio });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
