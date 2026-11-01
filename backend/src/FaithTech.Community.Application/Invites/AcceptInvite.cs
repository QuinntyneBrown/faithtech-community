using FaithTech.Community.Application.Organisations;
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
/// <summary>The invite as its anonymous page shows it; <see cref="PreassignedRoleName"/> is the organisation's name for the role.</summary>
public record InviteLookupDto(
    string Status, string Email, string InviterName, string? InviterChapterName, string? PreassignedRole, bool HasAccount, string? PreassignedRoleName = null);

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
    TimeProvider time,
    ICurrentOrganisation organisation,
    Memberships memberships)
{
    public async Task<InviteLookupDto?> LookUpAsync(string token, CancellationToken cancellationToken = default)
    {
        var invite = await FindAsync(token, cancellationToken);
        if (invite is null)
        {
            return null;
        }

        var inviter = await db.Profiles.AsNoTracking().Where(p => p.Id == invite.InvitedBy)
            .Select(p => new { p.Name, HomeCity = p.Chapter == null ? null : p.Chapter.Name }).SingleOrDefaultAsync(cancellationToken);
        return new InviteLookupDto(
            invite.Status(time.GetUtcNow()).ToString(),
            invite.Email,
            inviter?.Name ?? $"A {organisation.ShortName} lead",
            inviter?.HomeCity,
            invite.PreassignedRole?.ToString(),
            await users.FindByEmailAsync(invite.Email) is not null,
            (await PreassignedDefinitionAsync(invite, cancellationToken))?.Name);
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
            var user = new CommunityUser { Id = Guid.NewGuid(), UserName = invite.Email, Email = invite.Email, EmailConfirmed = true };
            profile.LinkAccount(user.Id);
            Grant(invite, profile, await PreassignedDefinitionAsync(invite, cancellationToken), now);
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

            // The invite is this organisation's, so the account joins it if it is not a member yet (L2-132 AC2).
            profile = await memberships.JoinAsync(user.Id, user.Email!, cancellationToken);
            Grant(invite, profile, await PreassignedDefinitionAsync(invite, cancellationToken), now);
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
    private void Grant(Invite invite, Profile profile, Domain.Organisations.RoleDefinition? definition, DateTimeOffset now)
    {
        if (definition is not null && !profile.HasRole(definition.Id))
        {
            var before = profile.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key).ToArray();
            profile.AddRole(definition, invite.InvitedBy, now.UtcDateTime);
            var after = profile.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key).ToArray();
            audit.Record(invite.InvitedBy, "role.granted", "Profile", profile.Id.ToString(), new { Roles = before }, new { Roles = after });
        }

        invite.MarkAccepted(profile.Id, now);

        // Provisioning's invite to the first administrator has no inviter to tell (L2-149 AC2).
        if (invite.InvitedBy == Guid.Empty)
        {
            return;
        }

        db.Notifications.Add(new Notification(
            invite.InvitedBy, NotificationKind.InviteAccepted, $"{profile.Name} accepted your invite", $"/people/{profile.Id}", now));
    }

    // The organisation's definition of the invite's pre-assigned role (L2-151 AC4); slice 14 stores a definition id.
    private async Task<Domain.Organisations.RoleDefinition?> PreassignedDefinitionAsync(Invite invite, CancellationToken cancellationToken)
    {
        if (invite.PreassignedRole is not { } key)
        {
            return null;
        }

        return await db.RoleDefinitions.SingleOrDefaultAsync(d => d.Key == key && d.ArchivedAtUtc == null, cancellationToken);
    }

    private Task<Invite?> FindAsync(string token, CancellationToken cancellationToken, bool tracked = false)
    {
        var hash = InviteTokens.Hash(token);
        var invites = tracked ? db.Invites : db.Invites.AsNoTracking();
        return invites.SingleOrDefaultAsync(i => i.TokenHash == hash, cancellationToken);
    }
}
