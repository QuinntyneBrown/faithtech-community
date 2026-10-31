using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Invites;

public record SendInviteCommand(string? Email, string? PreassignedRole = null, string? Note = null);

public class SendInviteValidator : AbstractValidator<SendInviteCommand>
{
    public const int MaxNote = 500;

    public SendInviteValidator()
    {
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter an email like name@example.org.")
            .EmailAddress().WithMessage("Enter an email like name@example.org.")
            .MaximumLength(256).WithMessage("Use 256 characters or fewer for the email.");
        RuleFor(x => x.Note)
            .Must(note => (note?.Trim().Length ?? 0) <= MaxNote).WithMessage($"Use {MaxNote} characters or fewer for the note.");
    }
}

/// <summary>Sends invites (L2-010) for leads and System Admins: role limits, verified sender, 50 per 24 hours.</summary>
public class InviteSender(
    IApplicationDbContext db,
    ICurrentUser current,
    RoleGrantPolicy policy,
    IEmailQueue emails,
    ICurrentOrganisation organisation,
    TimeProvider time)
{
    public const int MaxPerDay = 50;
    public const string RateLimitMessage = "You’ve sent 50 invites in the last 24 hours. Try again tomorrow.";


    public bool CanInvite => current.Has(Capability.InviteMembers);

    public async Task<(Result Result, InviteDto? Invite)> SendAsync(SendInviteCommand command, CancellationToken cancellationToken = default)
    {
        var role = string.IsNullOrEmpty(command.PreassignedRole) ? null : command.PreassignedRole;

        var note = string.IsNullOrWhiteSpace(command.Note) ? null : command.Note.Trim();
        return await CreateAsync(command.Email!.Trim(), role, note, cancellationToken);
    }

    /// <summary>Checks the sender and sends a new invite; shared by send and resend.</summary>
    public async Task<(Result Result, InviteDto? Invite)> CreateAsync(string address, string? role, string? note, CancellationToken cancellationToken)
    {
        if (!CanInvite)
        {
            return (Result.Forbidden(), null);
        }

        var sender = await db.Users.Where(u => u.Id == current.UserId)
            .Join(db.Profiles, u => (Guid?)u.Id, p => p.UserId, (u, p) => new { p.Id, p.Name, u.EmailConfirmed })
            .SingleOrDefaultAsync(cancellationToken);
        if (sender is null)
        {
            return (Result.Forbidden(), null);
        }

        if (!sender.EmailConfirmed)
        {
            return (Result.Forbidden("Verify your email before sending invites."), null);
        }

        var definition = role is null ? null : await db.RoleDefinitions.SingleOrDefaultAsync(d => d.Key == role && d.ArchivedAtUtc == null, cancellationToken);
        if (role is not null && definition is null)
        {
            return (Result.Invalid("PreassignedRole", "Choose a role from the list."), null);
        }

        if (definition is not null && !await policy.CanGrantAsync(definition, cancellationToken))
        {
            return (Result.Forbidden("You can’t give that role."), null);
        }

        var now = time.GetUtcNow();
        if (await db.Invites.CountAsync(i => i.InvitedBy == sender.Id && i.CreatedAt > now.AddHours(-24), cancellationToken) >= MaxPerDay)
        {
            return (Result.TooManyRequests(RateLimitMessage), null);
        }

        var token = InviteTokens.New();
        var invite = new Invite(address, InviteTokens.Hash(token), role, sender.Id, now, note);
        db.Invites.Add(invite);

        // The invite and its email are saved together, so neither exists without the other (L2-028, L2-047).
        var asRole = definition is null ? string.Empty : $" as a {definition.Name}";
        var personal = note is null ? string.Empty : $"\n\n“{note}”\n— {sender.Name}";
        emails.Enqueue(new EmailMessage(
            address,
            $"{sender.Name} invited you to {organisation.Name}",
            $"{sender.Name} invited you to join {organisation.Name}{asRole}.{personal}\n\n" +
            $"Accept the invite:\n\n{organisation.Origin}/accept-invite/{token}\n\n" +
            "This link works once and expires in 14 days."));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), InviteDto.From(invite, sender.Name, now));
    }
}
