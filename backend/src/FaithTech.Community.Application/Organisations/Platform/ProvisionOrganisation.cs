using System.Text.RegularExpressions;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Invites;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Organisations;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations.Platform;

/// <summary>POST /api/platform/organisations and <c>org create</c> (L2-149 AC1).</summary>
public record ProvisionOrganisationCommand(
    string? Slug, string? Host, string? Name, string? ShortName, string? AdminEmail, ChapterLabelCommand? ChapterLabel = null);

public partial class ProvisionOrganisationValidator : AbstractValidator<ProvisionOrganisationCommand>
{
    public ProvisionOrganisationValidator()
    {
        RuleFor(x => x.Slug).Must(slug => SlugPattern().IsMatch(slug?.Trim() ?? string.Empty))
            .WithMessage("Use 3 to 40 lower-case letters, digits and hyphens, starting with a letter or digit.");
        RuleFor(x => x.Host).Must(host => HostPattern().IsMatch(host?.Trim() ?? string.Empty) && host!.Trim().Length <= Organisation.MaxHostLength)
            .WithMessage("Enter a host name, such as app.example.org.");
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter a name.")
            .Must(name => name!.Trim().Length <= Organisation.MaxNameLength)
            .WithMessage($"Use {Organisation.MaxNameLength} characters or fewer for the name.");
        RuleFor(x => x.ShortName).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter a short name.")
            .Must(name => name!.Trim().Length <= Organisation.MaxShortNameLength)
            .WithMessage($"Use {Organisation.MaxShortNameLength} characters or fewer for the short name.");
        RuleFor(x => x.AdminEmail).Must(email =>
                !string.IsNullOrWhiteSpace(email) && System.Net.Mail.MailAddress.TryCreate(email.Trim(), out var address) && address.Address == email.Trim())
            .WithMessage("Enter the first administrator’s email address.");
        When(x => x.ChapterLabel is not null, () =>
        {
            RuleFor(x => x.ChapterLabel!.Singular).Cascade(CascadeMode.Stop)
                .Must(label => !string.IsNullOrWhiteSpace(label)).WithMessage("Give both forms of the chapter label, or neither.")
                .Must(label => label!.Trim().Length <= Organisation.MaxChapterLabelLength)
                .WithMessage($"Use {Organisation.MaxChapterLabelLength} characters or fewer for the singular label.");
            RuleFor(x => x.ChapterLabel!.Plural).Cascade(CascadeMode.Stop)
                .Must(label => !string.IsNullOrWhiteSpace(label)).WithMessage("Give both forms of the chapter label, or neither.")
                .Must(label => label!.Trim().Length <= Organisation.MaxChapterLabelLength)
                .WithMessage($"Use {Organisation.MaxChapterLabelLength} characters or fewer for the plural label.");
        });
    }

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{2,39}$")]
    private static partial Regex SlugPattern();

    // Lower or upper case labels of letters, digits and inner hyphens, at least two of them.
    [GeneratedRegex(@"^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")]
    private static partial Regex HostPattern();
}

public enum ProvisionOutcome
{
    Created,
    Exists,
}

/// <summary>
/// Provisions an organisation for an operator (L2-149): held as Provisioning while its defaults are written under its
/// own scope (two roles, default lists, the roster row and an invite to the first administrator pre-assigned
/// Administrator, the break-glass grant), then Active, with its host a redirect URI of the web client, recorded as
/// organisation.provisioned. The same command again reports Exists and changes nothing, or finishes a provisioning that
/// stopped part-way; the same slug with other fields is 409, and a host another organisation uses is 400.
/// </summary>
public class ProvisionOrganisationHandler(
    IApplicationDbContext db,
    OrganisationScope scope,
    OrganisationSeeder seeder,
    IEmailQueue emails,
    IClientRedirects redirects,
    IPlatformAuditLog audit,
    GetOrganisationSummaryHandler summaries,
    TimeProvider time)
{
    public async Task<(Result Result, ProvisionOutcome Outcome, OrganisationSummaryDto? Summary)> HandleAsync(
        ProvisionOrganisationCommand command, CancellationToken cancellationToken = default)
    {
        var slug = command.Slug!.Trim();
        var host = command.Host!.Trim().ToLowerInvariant();
        var name = command.Name!.Trim();
        var shortName = command.ShortName!.Trim();
        var adminEmail = command.AdminEmail!.Trim();
        var singular = command.ChapterLabel?.Singular?.Trim();
        var plural = command.ChapterLabel?.Plural?.Trim();

        var organisation = await db.Organisations.SingleOrDefaultAsync(o => o.Slug == slug, cancellationToken);
        if (organisation is not null)
        {
            var same = organisation.Host == host && organisation.Name == name && organisation.ShortName == shortName
                && organisation.ChapterLabelSingular == singular && organisation.ChapterLabelPlural == plural
                && await FirstAdministratorAsync(organisation.Id, cancellationToken) is { } invited
                && string.Equals(invited, adminEmail, StringComparison.OrdinalIgnoreCase);
            if (!same && organisation.Status != OrganisationStatus.Provisioning)
            {
                return (Result.Conflict($"An organisation called {slug} exists with other settings."), default, null);
            }

            if (organisation.Status != OrganisationStatus.Provisioning)
            {
                return (Result.Ok(), ProvisionOutcome.Exists, await summaries.HandleAsync(slug, cancellationToken));
            }
        }
        else
        {
            if (await db.Organisations.AnyAsync(o => o.Host == host, cancellationToken))
            {
                return (Result.Invalid(nameof(ProvisionOrganisationCommand.Host), $"Another organisation uses {host}."), default, null);
            }

            organisation = Organisation.ForProvisioning(Guid.NewGuid(), slug, host, name, shortName, time.GetUtcNow().UtcDateTime);
            organisation.SetChapterLabel(singular, plural);
            db.Organisations.Add(organisation);
            await db.SaveChangesAsync(cancellationToken);
        }

        // Everything the organisation starts with is stamped with it, as its own requests would be.
        scope.Set(organisation);
        await seeder.SeedOrganisationAsync(OrganisationSeed.Default(), cancellationToken);
        if (await FirstAdministratorAsync(organisation.Id, cancellationToken) is null)
        {
            Invite(adminEmail, organisation);
        }

        organisation.CompleteProvisioning();
        audit.Record("organisation.provisioned", slug, slug, new { host, name, shortName, AdminEmail = adminEmail });
        await db.SaveChangesAsync(cancellationToken);
        await redirects.AllowOriginAsync(scope.Origin, cancellationToken);
        return (Result.Ok(), ProvisionOutcome.Created, await summaries.HandleAsync(slug, cancellationToken));
    }

    // The email of the invite pre-assigned Administrator that provisioning sent, if any.
    private Task<string?> FirstAdministratorAsync(Guid organisationId, CancellationToken cancellationToken) =>
        db.Invites.IgnoreQueryFilters()
            .Where(i => i.OrganisationId == organisationId && i.PreassignedRole == OrganisationSeed.AdministratorKey && i.InvitedBy == Guid.Empty)
            .Select(i => i.Email)
            .FirstOrDefaultAsync(cancellationToken);

    // The break-glass grant: the one way an operator puts anyone inside an organisation (L2-149 AC2, L2-134 AC5).
    private void Invite(string email, Organisation organisation)
    {
        var token = InviteTokens.New();
        db.Invites.Add(new Invite(email, InviteTokens.Hash(token), OrganisationSeed.AdministratorKey, Guid.Empty, time.GetUtcNow()));
        emails.Enqueue(new EmailMessage(
            email,
            $"You’re the first administrator of {organisation.Name}",
            $"{organisation.Name} is ready on {scope.Origin}, and you’re its first administrator.\n\n" +
            $"Accept the invite:\n\n{scope.Origin}/accept-invite/{token}\n\n" +
            "This link works once and expires in 14 days."));
    }
}
