using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>Another organisation the account belongs to, as the switcher and the not-a-member page link to it.</summary>
public sealed record MembershipDto(string Name, string Host);

/// <summary>GET /api/me for a member of the host's organisation (L2-133 AC1).</summary>
public sealed record MeDto(
    Guid Id,
    Guid ProfileId,
    string Name,
    string? Email,
    bool EmailVerified,
    IReadOnlyCollection<string> Roles,
    MeOrganisationDto Organisation,
    IReadOnlyList<MembershipDto> Memberships);

public sealed record NotAMemberOrganisationDto(string Name);

/// <summary>GET /api/me's 403 body for a signed-in account with no membership of the host's organisation (L2-132 AC3).</summary>
public sealed record NotAMemberDto(string Reason, NotAMemberOrganisationDto Organisation, IReadOnlyList<MembershipDto> Memberships)
{
    public const string NotAMemberReason = "not-a-member";
}

/// <summary>
/// Answers GET /api/me from the database, so the name, email and roles stay current for a token's lifetime: the
/// caller's membership of the host's organisation, or, for an account with none (or only a suspended one), why not and
/// the account's other active memberships (ADR 0032).
/// </summary>
public class MeHandler(IApplicationDbContext db, ICurrentUser current, ICurrentOrganisation organisation, UserManager<CommunityUser> users)
{
    public async Task<(MeDto? Me, NotAMemberDto? NotAMember)> HandleAsync(CancellationToken cancellationToken = default)
    {
        var userId = current.UserId ?? throw new InvalidOperationException("GET /api/me requires a signed-in caller.");
        var memberships = await OtherMembershipsAsync(userId, cancellationToken);
        var user = await users.FindByIdAsync(userId.ToString());
        if (current.Membership is not { } membership || user is null)
        {
            return (null, new NotAMemberDto(NotAMemberDto.NotAMemberReason, new NotAMemberOrganisationDto(organisation.Name), memberships));
        }

        var name = await db.Profiles.Where(p => p.Id == membership.ProfileId).Select(p => p.Name).SingleAsync(cancellationToken);
        return (new MeDto(
            userId,
            membership.ProfileId,
            name,
            user.Email,
            user.EmailConfirmed,
            [.. membership.Roles.Select(r => r.ToString())],
            MeOrganisationDto.Of(organisation),
            memberships), null);
    }

    /// <summary>The account's active, unsuspended profiles in other active organisations, by name and host.</summary>
    private Task<List<MembershipDto>> OtherMembershipsAsync(Guid userId, CancellationToken cancellationToken) =>
        db.Profiles.IgnoreQueryFilters(QueryFilters.OrganisationOnly)
            .Where(p => p.UserId == userId && !p.IsSuspended && p.OrganisationId != organisation.Id)
            .Join(db.Organisations.Where(o => o.Status == OrganisationStatus.Active), p => p.OrganisationId, o => o.Id, (p, o) => new { o.Name, o.Host })
            .OrderBy(m => m.Name)
            .Select(m => new MembershipDto(m.Name, m.Host))
            .ToListAsync(cancellationToken);
}
