using System.Text.RegularExpressions;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Announcements;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>A role definition as the Roles page lists it (L2-136 AC6); capabilities in catalogue order.</summary>
public sealed record RoleDefinitionDto(
    Guid Id,
    string Key,
    string Name,
    string Description,
    IReadOnlyList<string> Capabilities,
    bool ShowOnTeam,
    bool ChapterScopable,
    bool IsOversight,
    int HolderCount,
    bool Archived,
    IReadOnlyList<Guid> GrantableRoleIds);

/// <summary>
/// POST and PUT /api/organisation/roles: a definition's name, description, capabilities and flags. The chapter-scopable
/// flag joins it with chapter tags (slice 21); until then a new role is not scopable and an edit keeps the flag it had.
/// </summary>
/// <remarks>
/// `ChapterScopable` is the "Can be held for a {chapter}" switch (L2-136 AC1); while chapters are off the dialog hides it
/// and the server keeps the role's current value (false for a new role).
/// </remarks>
public record RoleDefinitionCommand(
    string? Name, string? Description, string[]? Capabilities, bool ShowOnTeam, bool IsOversight, bool? ChapterScopable = null);

public class RoleDefinitionValidator : AbstractValidator<RoleDefinitionCommand>
{
    public RoleDefinitionValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Enter a name for the role.")
            .Must(name => name!.Trim().Length <= RoleDefinition.MaxNameLength)
            .WithMessage($"Use {RoleDefinition.MaxNameLength} characters or fewer for the name.");
        RuleFor(x => x.Description)
            .Must(description => (description?.Trim().Length ?? 0) <= RoleDefinition.MaxDescriptionLength)
            .WithMessage($"Use {RoleDefinition.MaxDescriptionLength} characters or fewer for the description.");
        RuleFor(x => x.Capabilities)
            .Must(capabilities => capabilities is null || capabilities.All(Capability.IsKnown))
            .WithMessage("Choose capabilities from the list.");
    }
}

/// <summary>
/// The organisation's role definitions for the Roles page (L2-136 AC6): non-archived in order, or the archived ones,
/// with how many profiles hold each. Either Organisation-section capability reads it (L2-147 AC2).
/// </summary>
public class ListRoleDefinitionsHandler(IApplicationDbContext db, ICurrentUser current)
{
    public async Task<(Result Result, IReadOnlyList<RoleDefinitionDto>? Definitions)> HandleAsync(
        bool archived, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageRoles) && !current.Has(Capability.ManageOrganisationSettings))
        {
            return (Result.Forbidden(), null);
        }

        var definitions = await db.RoleDefinitions.AsNoTracking()
            .Where(d => (d.ArchivedAtUtc != null) == archived)
            .OrderBy(d => d.SortOrder).ThenBy(d => d.Name)
            .ToListAsync(cancellationToken);
        var ids = definitions.Select(d => d.Id).ToList();
        var counts = await db.Profiles.AsNoTracking()
            .SelectMany(p => p.Roles)
            .Where(r => ids.Contains(r.RoleDefinitionId))
            .GroupBy(r => r.RoleDefinitionId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, cancellationToken);
        return (Result.Ok(), [.. definitions.Select(d => RoleDefinitions.Dto(d, counts.GetValueOrDefault(d.Id)))]);
    }
}

/// <summary>Defines a role for a holder of ManageRoles, audited as role.defined (L2-136 AC1, AC3, AC7, L2-152).</summary>
public class DefineRoleHandler(IApplicationDbContext db, ICurrentUser current, ICurrentOrganisation organisation, IAuditLog audit)
{
    public async Task<(Result Result, RoleDefinitionDto? Definition)> HandleAsync(
        RoleDefinitionCommand command, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageRoles) || current.Membership is not { } membership)
        {
            return (Result.Forbidden(), null);
        }

        var capabilities = command.Capabilities ?? [];
        if (RoleDefinitions.AddsAdministration(current, [], capabilities))
        {
            return (Result.Forbidden(RoleDefinitions.OnlyAnAdministratorMessage), null);
        }

        var name = command.Name!.Trim();
        if (await RoleDefinitions.NameTakenAsync(db, name, null, cancellationToken))
        {
            return (Result.Invalid("Name", RoleDefinitions.NameTaken(name)), null);
        }

        var keys = await db.RoleDefinitions.Select(d => d.Key).ToListAsync(cancellationToken);
        var sortOrder = await db.RoleDefinitions.MaxAsync(d => (int?)d.SortOrder, cancellationToken) ?? 0;
        var definition = new RoleDefinition(
            Guid.NewGuid(), RoleDefinitions.KeyFor(name, keys), name, command.Description ?? string.Empty, capabilities, sortOrder + 1);
        definition.SetFlags(command.ShowOnTeam, organisation.ChapterLabelSingular is not null && command.ChapterScopable == true, command.IsOversight);
        db.RoleDefinitions.Add(definition);
        audit.Record(membership.ProfileId, "role.defined", "RoleDefinition", definition.Id.ToString(), null, RoleDefinitions.State(definition));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), RoleDefinitions.Dto(definition, 0));
    }
}

/// <summary>
/// Edits a role definition for a holder of ManageRoles, live for every holder on their next request (L2-136 AC2,
/// L2-133 AC5), audited as role.updated. Dropping AdministerOrganisation takes the last-administrator lease and is
/// refused when no administrator would be left (L2-136 AC5, L2-139 AC1); a capability a holder loses outright raises
/// CapabilityLost for them (L2-139 AC3), and a gained one raises nothing (L2-139 AC6).
/// </summary>
public class UpdateRoleDefinitionHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    ICurrentOrganisation organisation,
    IAuditLog audit,
    LastAdministratorGuard lastAdministrator,
    CapabilityLostHandler capabilityLost)
{
    public async Task<(Result Result, RoleDefinitionDto? Definition)> HandleAsync(
        Guid id, RoleDefinitionCommand command, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageRoles) || current.Membership is not { } membership)
        {
            return (Result.Forbidden(), null);
        }

        var definition = await db.RoleDefinitions.SingleOrDefaultAsync(d => d.Id == id && d.ArchivedAtUtc == null, cancellationToken);
        if (definition is null)
        {
            return (Result.NotFound(), null);
        }

        var capabilities = command.Capabilities ?? [];
        if (RoleDefinitions.AddsAdministration(current, definition.Capabilities, capabilities))
        {
            return (Result.Forbidden(RoleDefinitions.OnlyAnAdministratorMessage), null);
        }

        var name = command.Name!.Trim();
        if (await RoleDefinitions.NameTakenAsync(db, name, id, cancellationToken))
        {
            return (Result.Invalid("Name", RoleDefinitions.NameTaken(name)), null);
        }

        if (definition.Carries(Capability.AdministerOrganisation) && !capabilities.Contains(Capability.AdministerOrganisation))
        {
            if (!await lastAdministrator.TakeLeaseAsync(cancellationToken))
            {
                return (Result.Conflict(LastAdministratorGuard.ConcurrentChangeMessage), null);
            }

            var wouldLeaveNone = await lastAdministrator.WouldLeaveNoneAsync(excludingDefinition: id, cancellationToken: cancellationToken);
            lastAdministrator.Release();
            if (wouldLeaveNone)
            {
                await db.SaveChangesAsync(cancellationToken);
                return (Result.Conflict(LastAdministratorGuard.LastAdministratorMessage), null);
            }
        }

        var before = RoleDefinitions.State(definition);
        var lost = definition.Capabilities.Except(capabilities, StringComparer.Ordinal).ToList();
        definition.Rename(name);
        definition.Describe(command.Description);
        definition.SetCapabilities(capabilities);
        var scopable = organisation.ChapterLabelSingular is null ? definition.ChapterScopable : command.ChapterScopable ?? definition.ChapterScopable;
        definition.SetFlags(command.ShowOnTeam, scopable, command.IsOversight);
        audit.Record(membership.ProfileId, "role.updated", "RoleDefinition", id.ToString(), before, RoleDefinitions.State(definition));

        var holders = await HoldersLosingAsync(id, lost, cancellationToken);
        foreach (var (profileId, capability) in holders)
        {
            await capabilityLost.HandleAsync(new CapabilityLost(profileId, capability), cancellationToken);
        }

        await capabilityLost.QueueEmailsAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        var count = await db.Profiles.CountAsync(p => p.Roles.Any(r => r.RoleDefinitionId == id), cancellationToken);
        return (Result.Ok(), RoleDefinitions.Dto(definition, count));
    }

    /// <summary>Each holder and each of <paramref name="lost"/> that no other non-archived role of theirs carries.</summary>
    private async Task<List<(Guid ProfileId, string Capability)>> HoldersLosingAsync(
        Guid id, IReadOnlyCollection<string> lost, CancellationToken cancellationToken)
    {
        if (lost.Count == 0)
        {
            return [];
        }

        var held = await db.Profiles.AsNoTracking()
            .Where(p => p.Roles.Any(r => r.RoleDefinitionId == id))
            .SelectMany(p => p.Roles.Select(r => new { ProfileId = p.Id, r.RoleDefinitionId }))
            .ToListAsync(cancellationToken);
        var others = held.Where(h => h.RoleDefinitionId != id).Select(h => h.RoleDefinitionId).Distinct().ToList();
        var carried = await db.RoleDefinitions.AsNoTracking()
            .Where(d => others.Contains(d.Id) && d.ArchivedAtUtc == null)
            .ToDictionaryAsync(d => d.Id, d => d.Capabilities, cancellationToken);
        return
        [
            .. held.GroupBy(h => h.ProfileId).SelectMany(profile => lost
                .Where(capability => !profile.Any(h => carried.TryGetValue(h.RoleDefinitionId, out var c) && c.Contains(capability)))
                .Select(capability => (profile.Key, capability))),
        ];
    }
}

/// <summary>PUT /api/organisation/roles/{id}/grants: the roles the grantor's holders may add and remove.</summary>
public record GrantRulesCommand(Guid[]? GrantableRoleIds);

/// <summary>
/// Saves a role's grant rules for a holder of ManageRoles, audited as role.grants.updated (L2-137 AC1). Rules for a
/// grantor without AssignRoles are stored and inactive (AC2); a grantable carrying AdministerOrganisation under a grantor
/// that does not is refused (AC3). The rules reach every holder's grantable roles on their next request.
/// </summary>
public class SetGrantRulesHandler(IApplicationDbContext db, ICurrentUser current, IAuditLog audit)
{
    public async Task<(Result Result, RoleDefinitionDto? Definition)> HandleAsync(
        Guid id, GrantRulesCommand command, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageRoles) || current.Membership is not { } membership)
        {
            return (Result.Forbidden(), null);
        }

        var definition = await db.RoleDefinitions.SingleOrDefaultAsync(d => d.Id == id && d.ArchivedAtUtc == null, cancellationToken);
        if (definition is null)
        {
            return (Result.NotFound(), null);
        }

        var ids = (command.GrantableRoleIds ?? []).Where(g => g != id).Distinct().ToList();
        var grantables = await db.RoleDefinitions.AsNoTracking()
            .Where(d => ids.Contains(d.Id) && d.ArchivedAtUtc == null)
            .OrderBy(d => d.SortOrder)
            .ToListAsync(cancellationToken);
        if (grantables.Count != ids.Count)
        {
            return (Result.Invalid(nameof(GrantRulesCommand.GrantableRoleIds), "Choose roles from the list."), null);
        }

        if (!definition.Carries(Capability.AdministerOrganisation)
            && grantables.FirstOrDefault(g => g.Carries(Capability.AdministerOrganisation)) is { } administration)
        {
            return (Result.Invalid(
                nameof(GrantRulesCommand.GrantableRoleIds),
                $"Only administrators can grant administration. Untick {administration.Name} to save."), null);
        }

        var before = definition.Grants.Select(g => g.GrantableRoleId).ToList();
        definition.SetGrantableRoles(ids);
        audit.Record(
            membership.ProfileId, "role.grants.updated", "RoleDefinition", id.ToString(),
            new { GrantableRoleIds = before }, new { GrantableRoleIds = ids, Names = grantables.Select(g => g.Name) });
        await db.SaveChangesAsync(cancellationToken);
        var count = await db.Profiles.CountAsync(p => p.Roles.Any(r => r.RoleDefinitionId == id), cancellationToken);
        return (Result.Ok(), RoleDefinitions.Dto(definition, count));
    }
}

/// <summary>
/// Archives a role for a holder of ManageRoles once nothing uses it, audited as role.archived (L2-136 AC4): refused while
/// any profile holds it, or a grant rule, a share audience or an announcement audience names it, and while it is the
/// last administrators' role (AC5, L2-139 AC1). An archived role leaves every picker.
/// </summary>
public class ArchiveRoleDefinitionHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    IAuditLog audit,
    LastAdministratorGuard lastAdministrator,
    TimeProvider time)
{
    public async Task<(Result Result, RoleDefinitionDto? Definition)> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageRoles) || current.Membership is not { } membership)
        {
            return (Result.Forbidden(), null);
        }

        var definition = await db.RoleDefinitions.SingleOrDefaultAsync(d => d.Id == id && d.ArchivedAtUtc == null, cancellationToken);
        if (definition is null)
        {
            return (Result.NotFound(), null);
        }

        var holders = await db.Profiles.CountAsync(p => p.Roles.Any(r => r.RoleDefinitionId == id), cancellationToken);
        if (holders > 0)
        {
            var who = holders == 1 ? "1 member holds" : $"{holders} members hold";
            return (Result.Conflict($"{who} this role. Remove it from them first."), null);
        }

        var users = await UsersAsync(id, cancellationToken);
        if (users.Count > 0)
        {
            var verb = users.Count > 1 || users[0].EndsWith("grant rules", StringComparison.Ordinal) ? "use" : "uses";
            return (Result.Conflict($"{RoleDefinitions.Join(users)} still {verb} this role. Remove it from them first."), null);
        }

        if (definition.Carries(Capability.AdministerOrganisation))
        {
            if (!await lastAdministrator.TakeLeaseAsync(cancellationToken))
            {
                return (Result.Conflict(LastAdministratorGuard.ConcurrentChangeMessage), null);
            }

            var wouldLeaveNone = await lastAdministrator.WouldLeaveNoneAsync(excludingDefinition: id, cancellationToken: cancellationToken);
            lastAdministrator.Release();
            if (wouldLeaveNone)
            {
                await db.SaveChangesAsync(cancellationToken);
                return (Result.Conflict(LastAdministratorGuard.LastAdministratorMessage), null);
            }
        }

        definition.Archive(time.GetUtcNow().UtcDateTime);
        audit.Record(membership.ProfileId, "role.archived", "RoleDefinition", id.ToString(), RoleDefinitions.State(definition), new { Archived = true });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), RoleDefinitions.Dto(definition, 0));
    }

    /// <summary>What still names the role: grantors' rules, share audiences and announcement audiences, in that order.</summary>
    private async Task<List<string>> UsersAsync(Guid id, CancellationToken cancellationToken)
    {
        var grantors = await db.RoleDefinitions.AsNoTracking()
            .Where(d => d.ArchivedAtUtc == null && d.Id != id && d.Grants.Any(g => g.GrantableRoleId == id))
            .OrderBy(d => d.SortOrder)
            .Select(d => d.Name)
            .ToListAsync(cancellationToken);
        var resources = await db.Resources.AsNoTracking()
            .Where(r => r.SharedRoles.Any(s => s.RoleDefinitionId == id))
            .OrderBy(r => r.Title)
            .Select(r => r.Title)
            .ToListAsync(cancellationToken);
        var pages = await db.NotePages.AsNoTracking()
            .Where(p => p.SharedRoles.Any(s => s.RoleDefinitionId == id))
            .OrderBy(p => p.Title)
            .Select(p => p.Title)
            .ToListAsync(cancellationToken);
        // The audience's role ids are stored as text, so the role audiences are read and matched here.
        var announcements = (await db.Announcements.AsNoTracking()
                .Where(a => a.Audience.Kind == AudienceKind.Roles)
                .Select(a => new { a.Subject, a.Audience.RoleIds })
                .ToListAsync(cancellationToken))
            .Where(a => a.RoleIds.Contains(id))
            .Select(a => a.Subject)
            .Order(StringComparer.Ordinal);
        return
        [
            .. grantors.Select(name => $"{name}’s grant rules"),
            .. resources.Select(title => $"the resource “{title}”"),
            .. pages.Select(title => $"the page “{title}”"),
            .. announcements.Select(subject => $"the announcement audience “{subject}”"),
        ];
    }
}

/// <summary>Rules the role definition handlers share.</summary>
public static partial class RoleDefinitions
{
    public const string OnlyAnAdministratorMessage = "Only an administrator can grant administration.";

    public static string NameTaken(string name) => $"A role called {name} already exists. Choose another name.";

    public static RoleDefinitionDto Dto(RoleDefinition d, int holderCount) => new(
        d.Id,
        d.Key,
        d.Name,
        d.Description,
        [.. Capability.All.Select(c => c.Key).Where(d.Carries)],
        d.ShowOnTeam,
        d.ChapterScopable,
        d.IsOversight,
        holderCount,
        d.IsArchived,
        [.. d.Grants.Select(g => g.GrantableRoleId)]);

    /// <summary>"a", "a and b", "a, b and c".</summary>
    public static string Join(IReadOnlyList<string> items) =>
        items.Count == 1 ? items[0] : $"{string.Join(", ", items.Take(items.Count - 1))} and {items[^1]}";

    /// <summary>What the audit records before and after (L2-152).</summary>
    public static object State(RoleDefinition d) =>
        new { d.Name, d.Description, d.Capabilities, d.ShowOnTeam, d.ChapterScopable, d.IsOversight };

    /// <summary>Whether the change adds AdministerOrganisation for a caller who does not hold it (L2-136 AC7).</summary>
    public static bool AddsAdministration(ICurrentUser current, IEnumerable<string> before, IEnumerable<string> after) =>
        after.Contains(Capability.AdministerOrganisation)
        && !before.Contains(Capability.AdministerOrganisation)
        && !current.Capabilities.Contains(Capability.AdministerOrganisation);

    /// <summary>Whether a non-archived definition other than <paramref name="except"/> has the name, ignoring case.</summary>
    public static Task<bool> NameTakenAsync(IApplicationDbContext db, string name, Guid? except, CancellationToken cancellationToken)
    {
        var lower = name.ToLowerInvariant();
        return db.RoleDefinitions.AnyAsync(
            d => d.ArchivedAtUtc == null && d.Id != except && d.Name.ToLower() == lower, cancellationToken);
    }

    /// <summary>A stable key from the name, numbered when the organisation already uses it.</summary>
    public static string KeyFor(string name, IReadOnlyCollection<string> taken)
    {
        var slug = NotSlug().Replace(name.ToLowerInvariant(), "-").Trim('-');
        slug = slug.Length == 0 ? "role" : slug[..Math.Min(slug.Length, RoleDefinition.MaxKeyLength - 4)];
        var used = taken.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var key = slug;
        for (var n = 2; used.Contains(key); n++)
        {
            key = $"{slug}-{n}";
        }

        return key;
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NotSlug();
}
