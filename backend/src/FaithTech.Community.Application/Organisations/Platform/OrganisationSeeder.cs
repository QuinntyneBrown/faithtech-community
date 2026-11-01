using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations.Platform;

/// <summary>The records an organisation starts with: its role definitions and its three lists.</summary>
public record OrganisationSeed(
    IReadOnlyList<RoleDefinition> Roles,
    IReadOnlyList<PartnerStage> Stages,
    IReadOnlyList<EventType> EventTypes,
    IReadOnlyList<ResourceType> ResourceTypes)
{
    public const string AdministratorKey = "administrator";

    public const string MemberKey = "member";

    /// <summary>
    /// What provisioning gives a new organisation (L2-149 AC1): Administrator and Member, the stages New and Confirmed,
    /// the event type Gathering and the resource types Deck, Image, Document and Other.
    /// </summary>
    public static OrganisationSeed Default()
    {
        var administrator = new RoleDefinition(
            Guid.NewGuid(), AdministratorKey, "Administrator", "Runs the organisation and its settings", [Capability.AdministerOrganisation], 0);
        administrator.SetFlags(showOnTeam: false, chapterScopable: false, isOversight: false);
        var member = new RoleDefinition(Guid.NewGuid(), MemberKey, "Member", "Belongs to the organisation", [], 1);
        member.SetFlags(showOnTeam: false, chapterScopable: false, isOversight: false);
        return new OrganisationSeed(
            [administrator, member],
            [
                new PartnerStage(Guid.NewGuid(), "new", "New", 1, isInitial: true, PartnerStageKind.Open),
                new PartnerStage(Guid.NewGuid(), "confirmed", "Confirmed", 2, isInitial: false, PartnerStageKind.Confirmed),
            ],
            [new EventType(Guid.NewGuid(), "gathering", "Gathering", 1)],
            [
                new ResourceType(Guid.NewGuid(), "deck", "Deck", 1),
                new ResourceType(Guid.NewGuid(), "image", "Image", 2),
                new ResourceType(Guid.NewGuid(), "document", "Document", 3),
                new ResourceType(Guid.NewGuid(), ResourceType.OtherKey, "Other", 4),
            ]);
    }
}

/// <summary>
/// Gives the organisation in scope the records of an <see cref="OrganisationSeed"/> that it lacks, matched by key (or by
/// id, for rows a migration wrote), and its administrator roster row, so later edits survive a re-run. Shared by the
/// FaithTech seed and provisioning (L2-149, L2-151). The caller saves.
/// </summary>
public class OrganisationSeeder(IApplicationDbContext db, ICurrentOrganisation organisation)
{
    public async Task SeedOrganisationAsync(OrganisationSeed seed, CancellationToken cancellationToken = default)
    {
        var id = organisation.Id;
        var roleKeys = await db.RoleDefinitions.IgnoreQueryFilters().Where(d => d.OrganisationId == id).Select(d => d.Key).ToListAsync(cancellationToken);
        db.RoleDefinitions.AddRange(seed.Roles.Where(d => !roleKeys.Contains(d.Key)));

        var stageKeys = await db.PartnerStages.IgnoreQueryFilters().Where(s => s.OrganisationId == id).Select(s => s.Key).ToListAsync(cancellationToken);
        db.PartnerStages.AddRange(seed.Stages.Where(s => !stageKeys.Contains(s.Key)));

        var typeIds = seed.EventTypes.Select(t => t.Id).ToList();
        var types = await db.EventTypes.IgnoreQueryFilters()
            .Where(t => t.OrganisationId == id || typeIds.Contains(t.Id)).Select(t => new { t.Id, t.Key }).ToListAsync(cancellationToken);
        db.EventTypes.AddRange(seed.EventTypes.Where(t => !types.Any(e => e.Id == t.Id || e.Key == t.Key)));

        var kindIds = seed.ResourceTypes.Select(t => t.Id).ToList();
        var kinds = await db.ResourceTypes.IgnoreQueryFilters()
            .Where(t => t.OrganisationId == id || kindIds.Contains(t.Id)).Select(t => new { t.Id, t.Key }).ToListAsync(cancellationToken);
        db.ResourceTypes.AddRange(seed.ResourceTypes.Where(t => !kinds.Any(e => e.Id == t.Id || e.Key == t.Key)));

        // The concurrency token that guards the organisation's last administrator (LastAdministratorGuard).
        if (!await db.OrganisationAdminRosters.IgnoreQueryFilters().AnyAsync(r => r.OrganisationId == id, cancellationToken))
        {
            db.OrganisationAdminRosters.Add(new OrganisationAdminRoster());
        }
    }
}
