using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Contacts;
using FaithTech.Community.Application.Identity;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Invites;

/// <summary>The body of <c>POST /api/connect/sign-up</c>: a new account through a lead's connect link.</summary>
public record ConnectSignUpCommand(string? Token, string Name, string Email, string Password);

/// <summary>The L2-001 rules, plus the link's token (L2-083 AC1).</summary>
public class ConnectSignUpValidator : AbstractValidator<ConnectSignUpCommand>
{
    public ConnectSignUpValidator(IBreachedPasswordChecker breachedPasswords)
    {
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.Name).CommunityName();
        RuleFor(x => x.Email).CommunityEmail();
        RuleFor(x => x.Password).CommunityPassword(breachedPasswords);
    }
}

/// <summary>The body of <c>POST /api/connect</c>: the link's token, kept out of the URL.</summary>
public record ConnectRequest(string? Token);

/// <summary>What the signed-in member's connect page shows (L2-082 AC4, AC5; L2-084 AC6).</summary>
public record ConnectResultDto(string Outcome, string LeadName);

/// <summary>Signs up through a connect link, or connects a signed-in member (L2-082, L2-083).</summary>
public class ConnectHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    ConnectLinkHandler links,
    SignUpHandler signUp,
    ContactConnector connector,
    TimeProvider time)
{
    /// <summary>Connects the signed-in member to the link's owner, now or once their email is verified.</summary>
    public async Task<(Result Result, ConnectResultDto? Connection)> ConnectAsync(string token, CancellationToken cancellationToken = default)
    {
        if (await links.LookUpAsync(token, cancellationToken) is not { } lead)
        {
            return (Result.NotFound(), null);
        }

        var profileId = await db.Users.Where(u => u.Id == current.UserId).Select(u => u.ProfileId).SingleAsync(cancellationToken);
        var outcome = await connector.RequestAsync(lead.LeadProfileId, profileId, cancellationToken);
        return (Result.Ok(), new ConnectResultDto(outcome.ToString(), lead.LeadName));
    }

    public async Task<Result> SignUpAsync(ConnectSignUpCommand command, CancellationToken cancellationToken = default)
    {
        if (await links.FindOwnerAsync(command.Token!, cancellationToken) is not { } leadId)
        {
            return Result.NotFound();
        }

        var user = await signUp.CreateAsync(new SignUpCommand(command.Name, command.Email, command.Password), cancellationToken);

        // An existing email gets the same answer and nothing else, so the form discloses nothing (L2-083 AC2).
        // A new account waits for its email to be verified before the lead's contact is made (AC3, AC4).
        if (user is not null)
        {
            db.PendingConnections.Add(new Domain.Contacts.PendingConnection(user.ProfileId, leadId, time.GetUtcNow()));
            await db.SaveChangesAsync(cancellationToken);
        }

        return Result.Ok();
    }
}
