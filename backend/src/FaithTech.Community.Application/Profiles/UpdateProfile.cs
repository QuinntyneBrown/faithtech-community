using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

public record UpdateProfileCommand(string? Name, string? HomeCity, string? Bio);

public class UpdateProfileValidator : AbstractValidator<UpdateProfileCommand>
{
    public const int MaxName = 100;
    public const int MaxHomeCity = 100;
    public const int MaxBio = 400;

    public UpdateProfileValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter your name as you’d like people to see it.")
            .Must(name => name!.Trim().Length <= MaxName).WithMessage($"Use {MaxName} characters or fewer for your name.");
        RuleFor(x => x.HomeCity)
            .Must(city => (city?.Trim().Length ?? 0) <= MaxHomeCity).WithMessage($"Use {MaxHomeCity} characters or fewer for your home city.");
        RuleFor(x => x.Bio)
            .Must(bio => (bio?.Trim().Length ?? 0) <= MaxBio).WithMessage($"Use {MaxBio} characters or fewer for your bio.");
    }
}

public class UpdateProfileHandler(IApplicationDbContext db, ProfileAccess access, IAuditLog audit)
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

        var before = new { profile.Name, profile.HomeCity, profile.Bio };
        profile.Update(command.Name!.Trim(), Blank(command.HomeCity), Blank(command.Bio));
        if (editAccess == EditAccess.AdminOverride)
        {
            audit.Record(actor, "profile.updated", "Profile", profileId.ToString(), before, new { profile.Name, profile.HomeCity, profile.Bio });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
