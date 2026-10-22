using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Contacts;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Identity;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Invites;

/// <summary>What the invite link shows before anyone signs in (ADR 0006).</summary>
public record InviteLookupDto(string Status, string Email, string InviterName, string? InviterCity, string? PreassignedRole, bool HasAccount);

/// <summary>Accepts an invite: with a name and password as a new account, or without them as the signed-in account.</summary>
/// <summary>The body of <c>POST /api/invites/lookup</c>: the invite link's token, kept out of the URL.</summary>
public record InviteLookupRequest(string? Token);

public record AcceptInviteCommand(string? Token, string? Name = null, string? Password = null)
{
    public bool IsNewAccount => Name is not null || Password is not null;
}

public class AcceptInviteValidator : AbstractValidator<AcceptInviteCommand>
{
    public AcceptInviteValidator(IBreachedPasswordChecker breachedPasswords)
    {
        RuleFor(x => x.Token).NotEmpty();
        When(x => x.IsNewAccount, () =>
        {
            RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
                .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter your name.")
                .Must(name => name!.Trim().Length <= UpdateProfileValidator.MaxName)
                .WithMessage($"Use {UpdateProfileValidator.MaxName} characters or fewer for your name.");
            RuleFor(x => x.Password!).CommunityPassword(breachedPasswords);
        });
    }
}

/// <summary>Looks up and accepts invites (L2-011).</summary>
public class AcceptInviteHandler(
    IApplicationDbContext db,
    UserManager<CommunityUser> users,
    ICurrentUser current,
    IAuditLog audit,
    ContactSignedUpHandler contactSignedUp,
    TimeProvider time)
{
    public async Task<InviteLookupDto?> LookUpAsync(string token, CancellationToken cancellationToken = default)
    {
        var invite = await FindAsync(token, cancellationToken);
        if (invite is null)
        {
            return null;
        }

        var inviter = await db.Profiles.AsNoTracking().Where(p => p.Id == invite.InvitedBy)
            .Select(p => new { p.Name, p.HomeCity }).SingleOrDefaultAsync(cancellationToken);
        return new InviteLookupDto(
            invite.Status(time.GetUtcNow()).ToString(),
            invite.Email,
            inviter?.Name ?? "A FaithTech lead",
            inviter?.HomeCity,
            invite.PreassignedRole?.ToString(),
            await users.FindByEmailAsync(invite.Email) is not null);
    }

    public async Task<Result> AcceptAsync(AcceptInviteCommand command, CancellationToken cancellationToken = default)
    {
        if (!command.IsNewAccount && !current.IsAuthenticated)
        {
            return Result.Invalid("Name", "Enter your name.");
        }

        var invite = await FindAsync(command.Token!, cancellationToken, tracked: true);
        if (invite is null)
        {
            return Result.NotFound();
        }

        var now = time.GetUtcNow();
        var status = invite.Status(now);
        if (status != InviteStatus.Pending)
        {
            return Result.Conflict(status switch
            {
                InviteStatus.Expired => "This invite has expired.",
                InviteStatus.Revoked => "This invite was withdrawn.",
                _ => "This invite has already been used.",
            });
        }

        Profile profile;
        if (command.IsNewAccount)
        {
            if (await users.FindByEmailAsync(invite.Email) is not null)
            {
                return Result.Conflict("An account already uses this email. Sign in to accept the invite.");
            }

            profile = new Profile(command.Name!.Trim(), now.UtcDateTime);
            db.Profiles.Add(profile);
            // The invite reached this address, so the email counts as verified (L2-011 AC1).
            var user = new CommunityUser { UserName = invite.Email, Email = invite.Email, EmailConfirmed = true, ProfileId = profile.Id };
            Grant(invite, profile, now);
            var created = await users.CreateAsync(user, command.Password!);
            if (!created.Succeeded)
            {
                throw new InvalidOperationException($"Account creation failed: {string.Join(", ", created.Errors.Select(e => e.Code))}");
            }
        }
        else
        {
            var user = await users.FindByIdAsync(current.UserId!.Value.ToString());
            if (user is null || !string.Equals(users.NormalizeEmail(user.Email), users.NormalizeEmail(invite.Email), StringComparison.Ordinal))
            {
                return Result.Conflict("This invite is for another email.");
            }

            profile = await db.Profiles.SingleAsync(p => p.Id == user.ProfileId, cancellationToken);
            Grant(invite, profile, now);
        }

        await db.SaveChangesAsync(cancellationToken);
        if (command.IsNewAccount)
        {
            // The new account is verified on creation, so it is matched against private contacts now (L2-015).
            await contactSignedUp.HandleAsync(new EmailVerified(profile.Id, invite.Email), cancellationToken);
        }

        return Result.Ok();
    }

    // Grants the pre-assigned role, audited with the inviter as actor, marks the invite used and tells the inviter.
    private void Grant(Invite invite, Profile profile, DateTimeOffset now)
    {
        if (invite.PreassignedRole is { } role && !profile.HasRole(role))
        {
            var before = profile.Roles.Select(r => r.Role).Order().Select(r => r.ToString()).ToArray();
            profile.AddRole(role, invite.InvitedBy, now.UtcDateTime);
            var after = profile.Roles.Select(r => r.Role).Order().Select(r => r.ToString()).ToArray();
            audit.Record(invite.InvitedBy, "role.granted", "Profile", profile.Id.ToString(), new { Roles = before }, new { Roles = after });
        }

        invite.MarkAccepted(profile.Id, now);
        db.Notifications.Add(new Notification(
            invite.InvitedBy, NotificationKind.InviteAccepted, $"{profile.Name} accepted your invite", $"/people/{profile.Id}", now));
    }

    private Task<Invite?> FindAsync(string token, CancellationToken cancellationToken, bool tracked = false)
    {
        var hash = InviteTokens.Hash(token);
        var invites = tracked ? db.Invites : db.Invites.AsNoTracking();
        return invites.SingleOrDefaultAsync(i => i.TokenHash == hash, cancellationToken);
    }
}
