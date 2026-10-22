using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

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
public record ConnectLookupDto(Guid LeadProfileId, string LeadName, string? LeadPhotoUrl, string? LeadCity, string LeadRole);

/// <summary>The body of <c>POST /api/connect/lookup</c>: the link's token, kept out of the URL.</summary>
public record ConnectLookupRequest(string? Token);

/// <summary>Issues, shows, replaces and looks up City Leads' connect links (L2-080, L2-081, L2-082).</summary>
public class ConnectLinkHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    IConnectTokenProtector protector,
    IPhotoStorage storage,
    IOptions<WebAppOptions> webApp,
    TimeProvider time)
{
    public bool CanHaveLink => current.HasRole(Role.CityLead) || current.HasRole(Role.SystemAdmin);

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
        var role = lead.HasRole(Role.CityLead) ? Role.CityLead : Role.SystemAdmin;
        return new ConnectLookupDto(
            lead.Id, lead.Name, featured is null ? null : storage.GetReadUrl(featured.BlobName), lead.HomeCity, RoleLabels.Of(role));
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

        // A suspended owner, or one who no longer holds City Lead or System Admin, has no working link (ADR 0021).
        var profile = await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.Id == owner, cancellationToken);
        return profile is { IsSuspended: false } && (profile.HasRole(Role.CityLead) || profile.HasRole(Role.SystemAdmin))
            ? profile
            : null;
    }

    private async Task<Guid?> CallerAsync(CancellationToken cancellationToken)
    {
        if (!CanHaveLink)
        {
            return null;
        }

        return await db.Users.Where(u => u.Id == current.UserId).Select(u => (Guid?)u.ProfileId).SingleOrDefaultAsync(cancellationToken);
    }

    private ConnectLinkDto ToDto(string token) => new($"{webApp.Value.Origin}/meet/{token}");
}
