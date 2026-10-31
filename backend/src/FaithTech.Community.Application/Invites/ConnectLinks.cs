using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Invites;

/// <summary>Encrypts a connect token so only its owner can be shown it again (ADR 0021).</summary>
public interface IConnectTokenProtector
{
    string Protect(string token);

    string Unprotect(string protectedToken);
}

/// <summary>The caller's connect link, as "My QR code" shows it.</summary>
public record ConnectLinkDto(string Url);

/// <summary>Who an anonymous visitor is connecting with (L2-082 AC2).</summary>
/// <remarks>`LeadRoleChapterName` is the chapter the link role is held for, so the page reads "{role} · {chapter}" (L2-141 AC3).</remarks>
public record ConnectLookupDto(
    Guid LeadProfileId, string LeadName, string? LeadPhotoUrl, string? LeadChapterName, string LeadRole, string? LeadRoleChapterName = null);

/// <summary>The body of <c>POST /api/connect/lookup</c>: the link's token, kept out of the URL.</summary>
public record ConnectLookupRequest(string? Token);

/// <summary>Issues, shows, replaces and looks up City Leads' connect links (L2-080, L2-081, L2-082).</summary>
public class ConnectLinkHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    IConnectTokenProtector protector,
    IPhotoStorage storage,
    ICurrentOrganisation organisation,
    TimeProvider time)
{
    public bool CanHaveLink => current.Has(Capability.ConnectLink);

    public async Task<(Result Result, ConnectLinkDto? Link)> GetOrIssueAsync(CancellationToken cancellationToken = default)
    {
        if (await CallerAsync(cancellationToken) is not { } owner)
        {
            return (Result.Forbidden(), null);
        }

        var link = await db.ConnectLinks.SingleOrDefaultAsync(l => l.OwnerId == owner, cancellationToken);
        if (link is not null)
        {
            return (Result.Ok(), ToDto(protector.Unprotect(link.ProtectedToken)));
        }

        var token = InviteTokens.New();
        db.ConnectLinks.Add(new ConnectLink(owner, InviteTokens.Hash(token), protector.Protect(token), time.GetUtcNow()));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), ToDto(token));
    }

    /// <summary>Replaces the caller's token; the old link answers as unknown from now on (L2-081 AC3).</summary>
    public async Task<(Result Result, ConnectLinkDto? Link)> ReplaceAsync(CancellationToken cancellationToken = default)
    {
        if (await CallerAsync(cancellationToken) is not { } owner)
        {
            return (Result.Forbidden(), null);
        }

        var token = InviteTokens.New();
        var link = await db.ConnectLinks.SingleOrDefaultAsync(l => l.OwnerId == owner, cancellationToken);
        if (link is null)
        {
            db.ConnectLinks.Add(new ConnectLink(owner, InviteTokens.Hash(token), protector.Protect(token), time.GetUtcNow()));
        }
        else
        {
            link.Replace(InviteTokens.Hash(token), protector.Protect(token), time.GetUtcNow());
        }

        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), ToDto(token));
    }

    public async Task<ConnectLookupDto?> LookUpAsync(string token, CancellationToken cancellationToken = default)
    {
        if (await FindOwnerProfileAsync(token, cancellationToken) is not { } lead)
        {
            return null;
        }

        var featured = lead.Photos.FirstOrDefault(p => p.IsFeatured && p.IsStored);
        return new ConnectLookupDto(
            lead.Id, lead.Name, featured is null ? null : storage.GetReadUrl(featured.BlobName), lead.Chapter?.Name, LinkRoleName(lead), LinkAssignment(lead)!.Chapter?.Name);
    }

    /// <summary>The profile id of the link's owner while they may still have a link, or null.</summary>
    public async Task<Guid?> FindOwnerAsync(string token, CancellationToken cancellationToken = default) =>
        (await FindOwnerProfileAsync(token, cancellationToken))?.Id;

    private async Task<Profile?> FindOwnerProfileAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var hash = InviteTokens.Hash(token);
        var owner = await db.ConnectLinks.AsNoTracking().Where(l => l.TokenHash == hash).Select(l => (Guid?)l.OwnerId)
            .SingleOrDefaultAsync(cancellationToken);
        if (owner is null)
        {
            return null;
        }

        // A suspended owner, or one whose current roles no longer give ConnectLink, has no working link (ADR 0021, L2-139 AC5).
        var profile = await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.Id == owner, cancellationToken);
        return profile is { IsSuspended: false } && LinkRole(profile) is not null ? profile : null;
    }

    /// <summary>The owner's first held role that gives ConnectLink, AdministerOrganisation standing in for it.</summary>
    private static RoleDefinition? LinkRole(Profile profile) => LinkAssignment(profile)?.Definition;

    /// <summary>The assignment of <see cref="LinkRole"/>: an untagged one first, then by chapter name.</summary>
    private static ProfileRole? LinkAssignment(Profile profile) =>
        profile.Roles.Where(r => r.Definition is { ArchivedAtUtc: null } d
                && (d.Capabilities.Contains(Capability.ConnectLink) || d.Capabilities.Contains(Capability.AdministerOrganisation)))
            .OrderBy(r => r.Definition!.SortOrder)
            .ThenBy(r => r.Chapter != null)
            .ThenBy(r => r.Chapter == null ? null : r.Chapter.Name)
            .FirstOrDefault();

    private static string LinkRoleName(Profile profile) => LinkRole(profile)!.Name;

    private async Task<Guid?> CallerAsync(CancellationToken cancellationToken)
    {
        if (!CanHaveLink)
        {
            return null;
        }

        return await Task.FromResult(current.ProfileId);
    }

    private ConnectLinkDto ToDto(string token) => new($"{organisation.Origin}/meet/{token}");
}
