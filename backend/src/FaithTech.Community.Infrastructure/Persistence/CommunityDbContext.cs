using System.Linq.Expressions;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Announcements;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Notes;
using FaithTech.Community.Domain.Resources;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Identity;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using FaithTech.Community.Infrastructure.Search;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace FaithTech.Community.Infrastructure.Persistence;

public class CommunityDbContext : IdentityDbContext<CommunityUser, IdentityRole<Guid>, Guid>, IApplicationDbContext
{
    private readonly ICurrentOrganisation _organisation;

    public CommunityDbContext(DbContextOptions<CommunityDbContext> options, ICurrentOrganisation organisation)
        : base(options)
    {
        _organisation = organisation;
    }

    /// <summary>
    /// A context with no organisation scope of its own works as the FaithTech organisation, the platform's first and
    /// default one: design-time tooling and tests that open the database directly.
    /// </summary>
    public CommunityDbContext(DbContextOptions<CommunityDbContext> options)
        : this(options, DefaultScope())
    {
    }

    /// <summary>The current organisation's id, read by every query filter when the query runs.</summary>
    private Guid CurrentOrganisationId => _organisation.Id;

    /// <summary>
    /// Whether the current organisation has chapters, read by the chapters filter when the query runs. Work scoped by
    /// id only (the Cli, workers) never hides them: it shows no one anything, and must find them to keep names unique.
    /// </summary>
    private bool ChaptersOn => _organisation is OrganisationScope { IsLoaded: false } || _organisation.ChapterLabelSingular != null;

    public DbSet<Organisation> Organisations => Set<Organisation>();

    public DbSet<Profile> Profiles => Set<Profile>();

    public DbSet<RoleDefinition> RoleDefinitions => Set<RoleDefinition>();

    public DbSet<Chapter> Chapters => Set<Chapter>();

    public DbSet<VerificationResend> VerificationResends => Set<VerificationResend>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();

    public DbSet<OrganisationAdminRoster> OrganisationAdminRosters => Set<OrganisationAdminRoster>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<Invite> Invites => Set<Invite>();

    public DbSet<ConnectLink> ConnectLinks => Set<ConnectLink>();

    public DbSet<Contact> Contacts => Set<Contact>();

    public DbSet<PendingConnection> PendingConnections => Set<PendingConnection>();

    public DbSet<ContactNote> ContactNotes => Set<ContactNote>();

    public DbSet<Partner> Partners => Set<Partner>();

    public DbSet<PartnerStageChange> PartnerStageChanges => Set<PartnerStageChange>();

    public DbSet<PartnerStage> PartnerStages => Set<PartnerStage>();

    public DbSet<EventType> EventTypes => Set<EventType>();

    public DbSet<ResourceType> ResourceTypes => Set<ResourceType>();

    public DbSet<PartnerActivity> PartnerActivities => Set<PartnerActivity>();

    public DbSet<PartnerDuplicateDismissal> PartnerDuplicateDismissals => Set<PartnerDuplicateDismissal>();

    public DbSet<Workspace> Workspaces => Set<Workspace>();

    public DbSet<WorkItem> WorkItems => Set<WorkItem>();

    public DbSet<Sprint> Sprints => Set<Sprint>();

    public DbSet<PokerSession> PokerSessions => Set<PokerSession>();

    public DbSet<PhotoBlobTask> PhotoBlobTasks => Set<PhotoBlobTask>();
    public DbSet<Event> Events => Set<Event>();

    public DbSet<Announcement> Announcements => Set<Announcement>();

    public DbSet<Resource> Resources => Set<Resource>();

    public DbSet<ResourceBlobTask> ResourceBlobTasks => Set<ResourceBlobTask>();

    public DbSet<NotePage> NotePages => Set<NotePage>();

    public DbSet<NoteLink> NoteLinks => Set<NoteLink>();

    public DbSet<NoteImage> NoteImages => Set<NoteImage>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.UseOpenIddict();

        builder.Entity<Organisation>(organisation =>
        {
            organisation.Property(o => o.Id).ValueGeneratedNever();
            organisation.Property(o => o.Slug).HasMaxLength(Organisation.MaxSlugLength);
            organisation.HasIndex(o => o.Slug).IsUnique();
            // Hosts are stored in lower case, so this index makes them unique case-insensitively (L2-131).
            organisation.Property(o => o.Host).HasMaxLength(Organisation.MaxHostLength);
            organisation.HasIndex(o => o.Host).IsUnique();
            organisation.Property(o => o.Name).HasMaxLength(Organisation.MaxNameLength);
            organisation.Property(o => o.ShortName).HasMaxLength(Organisation.MaxShortNameLength);
            organisation.Property(o => o.ChapterLabelSingular).HasMaxLength(Organisation.MaxChapterLabelLength);
            organisation.Property(o => o.ChapterLabelPlural).HasMaxLength(Organisation.MaxChapterLabelLength);
            organisation.Property(o => o.Status).HasConversion<string>().HasMaxLength(16);
            organisation.Property(o => o.SuspendedReason).HasMaxLength(500);
        });

        builder.Entity<Chapter>(chapter =>
        {
            chapter.Property(c => c.Id).ValueGeneratedNever();
            chapter.Property(c => c.Name).HasMaxLength(Chapter.MaxNameLength);
            chapter.Property(c => c.NormalizedName).HasMaxLength(Chapter.MaxNameLength);
            // An active chapter's name is unique in its organisation ignoring case; archived ones free theirs (L2-140 AC4).
            chapter.HasIndex(nameof(IOrganisationScoped.OrganisationId), nameof(Chapter.NormalizedName))
                .IsUnique()
                .HasFilter("\"ArchivedAtUtc\" IS NULL");
            chapter.Ignore(c => c.IsArchived);
            chapter.HasQueryFilter(QueryFilters.ChaptersOn, c => ChaptersOn);
        });

        builder.Entity<RoleDefinition>(definition =>
        {
            definition.Property(d => d.Id).ValueGeneratedNever();
            definition.Property(d => d.Key).HasMaxLength(RoleDefinition.MaxKeyLength);
            definition.HasIndex(nameof(IOrganisationScoped.OrganisationId), nameof(RoleDefinition.Key)).IsUnique();
            definition.Property(d => d.Name).HasMaxLength(RoleDefinition.MaxNameLength);
            definition.Property(d => d.Description).HasMaxLength(RoleDefinition.MaxDescriptionLength);
            definition.PrimitiveCollection(d => d.Capabilities);
            definition.OwnsMany(d => d.Grants, grant =>
            {
                grant.ToTable("RoleGrantRules");
                grant.WithOwner().HasForeignKey(g => g.GrantorRoleId);
                grant.HasKey(g => new { g.GrantorRoleId, g.GrantableRoleId });
                // Set by the caller, never generated, so a new rule on a loaded definition is inserted.
                grant.Property(g => g.GrantableRoleId).ValueGeneratedNever();
                grant.HasIndex(g => g.GrantableRoleId);
            });
            definition.Navigation(d => d.Grants).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<Profile>(profile =>
        {
            profile.Property(p => p.Name).HasMaxLength(200);
            // Reports and the team filter group members by chapter (ADR 0030, ADR 0034); a chapter is never deleted.
            profile.HasOne(p => p.Chapter).WithMany().HasForeignKey(p => p.ChapterId).OnDelete(DeleteBehavior.Restrict);
            profile.HasIndex(p => p.ChapterId);
            // Every view of a member shows the chapter's current name, so it comes with the profile.
            profile.Navigation(p => p.Chapter).AutoInclude();
            profile.Property(p => p.Bio).HasMaxLength(400);
            profile.Property(p => p.SuspendedReason).HasMaxLength(500);
            profile.Ignore(p => p.DomainEvents);
            profile.OwnsMany(p => p.Roles, role =>
            {
                role.ToTable("ProfileRoles");
                role.WithOwner().HasForeignKey(r => r.ProfileId);
                role.HasKey(r => r.Id);
                role.Property(r => r.Id).ValueGeneratedNever();
                // A definition once per chapter tag and once untagged (L2-138 AC7): null tags count as equal.
                role.HasIndex(r => new { r.ProfileId, r.RoleDefinitionId, r.ChapterId }).IsUnique().AreNullsDistinct(false);
                role.HasIndex(r => r.ChapterId);
                role.HasOne(r => r.Chapter).WithMany().HasForeignKey(r => r.ChapterId).OnDelete(DeleteBehavior.Restrict);
                role.Navigation(r => r.Chapter).AutoInclude();
                role.HasOne(r => r.Definition).WithMany().HasForeignKey(r => r.RoleDefinitionId).OnDelete(DeleteBehavior.Restrict);
                // Loaded with every profile, so the held roles' names, flags and capabilities are at hand (ADR 0033).
                role.Navigation(r => r.Definition).AutoInclude();
            });
            profile.OwnsMany(p => p.Photos, photo =>
            {
                photo.ToTable("ProfilePhotos");
                photo.WithOwner().HasForeignKey("ProfileId");
                photo.HasKey(p => p.Id);
                photo.Property(p => p.Id).ValueGeneratedNever();
                photo.Property(p => p.BlobName).HasMaxLength(200);
                photo.Property(p => p.AltText).HasMaxLength(300);
            });
            profile.OwnsOne(p => p.PhotoLease, lease =>
            {
                lease.ToTable("PhotoLeases");
                lease.WithOwner().HasForeignKey("ProfileId");
                lease.Property(l => l.Version).IsConcurrencyToken();
            });
            profile.Navigation(p => p.PhotoLease).IsRequired();
        });

        builder.Entity<PhotoBlobTask>(task =>
        {
            task.Property(t => t.Work).HasConversion<string>().HasMaxLength(16);
            task.Property(t => t.BlobName).HasMaxLength(200);
            task.Property(t => t.ContentType).HasMaxLength(32);
            task.HasIndex(t => t.NextAttemptAt);
            task.HasIndex(t => t.PhotoId);
        });

        builder.Entity<VerificationResend>(resend =>
        {
            resend.Property(r => r.NormalizedEmail).HasMaxLength(256);
            resend.HasIndex(r => new { r.NormalizedEmail, r.RequestedAt });
        });

        builder.Entity<OrganisationAdminRoster>(roster =>
        {
            roster.Property(r => r.Id).ValueGeneratedNever();
            roster.Property(r => r.Version).IsConcurrencyToken();
            // One roster per organisation (L2-139 AC2).
            roster.HasIndex(r => r.OrganisationId).IsUnique();
        });

        builder.Entity<OutboxMessage>(message =>
        {
            message.Property(m => m.To).HasMaxLength(256);
            message.Property(m => m.Subject).HasMaxLength(300);
            message.Property(m => m.LastError).HasMaxLength(500);
            message.HasIndex(m => new { m.SentAt, m.FailedAt, m.NextAttemptAt });
        });

        builder.Entity<AuditEntry>(entry =>
        {
            entry.Property(e => e.Id).ValueGeneratedNever();
            entry.Property(e => e.Action).HasMaxLength(100);
            entry.Property(e => e.TargetType).HasMaxLength(100);
            entry.Property(e => e.TargetId).HasMaxLength(100);
            entry.Property(e => e.IpAddress).HasMaxLength(45);
            entry.HasIndex(e => e.OccurredAtUtc);
        });

        builder.Entity<Notification>(notification =>
        {
            notification.Property(n => n.Id).ValueGeneratedNever();
            notification.Property(n => n.Kind).HasConversion<string>().HasMaxLength(48);
            notification.Property(n => n.Title).HasMaxLength(300);
            notification.Property(n => n.LinkPath).HasMaxLength(300);
            notification.Ignore(n => n.IsRead);
            notification.HasIndex(n => new { n.RecipientId, n.CreatedAt });
        });

        // Every unique rule holds within one organisation, so two organisations may each hold the same value (L2-130 AC4).
        builder.Entity<PendingConnection>(pending =>
        {
            pending.Property(p => p.Id).ValueGeneratedNever();
            pending.HasIndex(p => new { p.OrganisationId, p.ProfileId, p.LeadId }).IsUnique();
        });

        builder.Entity<ConnectLink>(link =>
        {
            link.Property(l => l.Id).ValueGeneratedNever();
            link.HasIndex(l => new { l.OrganisationId, l.OwnerId }).IsUnique();
            link.Property(l => l.TokenHash).HasMaxLength(64);
            link.HasIndex(l => new { l.OrganisationId, l.TokenHash }).IsUnique();
            link.Property(l => l.ProtectedToken).HasMaxLength(1024);
        });

        builder.Entity<Invite>(invite =>
        {
            invite.Property(i => i.Id).ValueGeneratedNever();
            invite.Property(i => i.Email).HasMaxLength(256);
            invite.Property(i => i.TokenHash).HasMaxLength(64);
            invite.HasIndex(i => new { i.OrganisationId, i.TokenHash }).IsUnique();
            invite.Property(i => i.PreassignedRole).HasMaxLength(32);
            invite.Property(i => i.Note).HasMaxLength(500);
            invite.HasIndex(i => new { i.InvitedBy, i.CreatedAt });
        });

        builder.Entity<Contact>(contact =>
        {
            contact.Property(c => c.Id).ValueGeneratedNever();
            contact.Property(c => c.Name).HasMaxLength(200);
            contact.Property(c => c.Email).HasMaxLength(256);
            contact.Property(c => c.Phone).HasMaxLength(200);
            contact.Property(c => c.Organization).HasMaxLength(200);
            contact.Property(c => c.City).HasMaxLength(200);
            contact.Ignore(c => c.IsArchived);
            contact.Ignore(c => c.CanBeDeleted);
            contact.HasIndex(c => new { c.OwnerId, c.ArchivedAtUtc });
            contact.HasIndex(c => c.Email);
            // Deleting a contact deletes its notes (L2-016 AC3).
            contact.HasMany(c => c.Notes).WithOne().HasForeignKey(n => n.ContactId).OnDelete(DeleteBehavior.Cascade);
            contact.Navigation(c => c.Notes).UsePropertyAccessMode(PropertyAccessMode.Field);
            // Photos are owned, so deleting a contact deletes them too (L2-070 AC6).
            contact.OwnsMany(c => c.Photos, photo =>
            {
                photo.ToTable("ContactPhotos");
                photo.WithOwner().HasForeignKey("ContactId");
                photo.HasKey(p => p.Id);
                photo.Property(p => p.Id).ValueGeneratedNever();
                photo.Property(p => p.BlobName).HasMaxLength(200);
                photo.Property(p => p.AltText).HasMaxLength(300);
            });
            contact.Navigation(c => c.Photos).UsePropertyAccessMode(PropertyAccessMode.Field);
            contact.OwnsOne(c => c.PhotoLease, lease =>
            {
                lease.ToTable("ContactPhotoLeases");
                lease.WithOwner().HasForeignKey("ContactId");
                lease.Property(l => l.Version).IsConcurrencyToken();
            });
            contact.Navigation(c => c.PhotoLease).IsRequired();
        });

        builder.Entity<ContactNote>(note =>
        {
            note.Property(n => n.Id).ValueGeneratedNever();
            note.Property(n => n.Body).HasMaxLength(2000);
            note.HasIndex(n => new { n.ContactId, n.CreatedAtUtc });
        });

        builder.Entity<Partner>(partner =>
        {
            partner.Property(p => p.Id).ValueGeneratedNever();
            partner.Property(p => p.Name).HasMaxLength(200);
            partner.Property(p => p.Website).HasMaxLength(200);
            partner.Property(p => p.Offering).HasMaxLength(200);
            partner.Property(p => p.ContactName).HasMaxLength(200);
            partner.Property(p => p.Email).HasMaxLength(256);
            partner.Property(p => p.Phone).HasMaxLength(200);
            partner.Property(p => p.Notes).HasMaxLength(2000);
            partner.HasOne(p => p.Stage).WithMany().HasForeignKey(p => p.StageId).OnDelete(DeleteBehavior.Restrict);
            partner.Navigation(p => p.Stage).AutoInclude();
            // Merge and restore compare versions; a race the check misses fails at SaveChanges (ADR 0028).
            partner.Property(p => p.Version).IsConcurrencyToken();
            partner.HasIndex(p => p.ArchivedAtUtc);
            partner.Ignore(p => p.IsArchived);
            partner.HasMany(p => p.StageChanges).WithOne().HasForeignKey(c => c.PartnerId).OnDelete(DeleteBehavior.Cascade);
            partner.Navigation(p => p.StageChanges).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        // An organisation's partner stages (L2-144); the key is stable and unique within the organisation.
        builder.Entity<PartnerStage>(stage =>
        {
            stage.ToTable("PartnerStages");
            stage.Property(s => s.Id).ValueGeneratedNever();
            stage.Property(s => s.Key).HasMaxLength(PartnerStage.MaxName);
            stage.Property(s => s.Name).HasMaxLength(PartnerStage.MaxName);
            stage.Property(s => s.Kind).HasConversion<string>().HasMaxLength(16);
            stage.HasIndex(nameof(IOrganisationScoped.OrganisationId), nameof(PartnerStage.Key)).IsUnique();
            stage.Ignore(s => s.IsArchived);
        });

        builder.Entity<EventType>(type =>
        {
            type.ToTable("EventTypes");
            type.Property(t => t.Id).ValueGeneratedNever();
            type.Property(t => t.Key).HasMaxLength(EventType.MaxName);
            type.Property(t => t.Name).HasMaxLength(EventType.MaxName);
            type.Ignore(t => t.IsArchived);
            type.HasIndex(nameof(IOrganisationScoped.OrganisationId), nameof(EventType.Key)).IsUnique();
        });

        builder.Entity<ResourceType>(type =>
        {
            type.ToTable("ResourceTypes");
            type.Property(t => t.Id).ValueGeneratedNever();
            type.Property(t => t.Key).HasMaxLength(ResourceType.MaxName);
            type.Property(t => t.Name).HasMaxLength(ResourceType.MaxName);
            type.Ignore(t => t.IsArchived);
            type.Ignore(t => t.CanArchive);
            type.HasIndex(nameof(IOrganisationScoped.OrganisationId), nameof(ResourceType.Key)).IsUnique();
        });

        builder.Entity<PartnerStageChange>(change =>
        {
            change.ToTable("PartnerStageChanges");
            change.Property(c => c.Id).ValueGeneratedNever();
            change.Property(c => c.From).HasMaxLength(PartnerStage.MaxName);
            change.Property(c => c.To).HasMaxLength(PartnerStage.MaxName);
            change.Property(c => c.Note).HasMaxLength(500);
            change.HasIndex(c => new { c.PartnerId, c.MovedAtUtc });
            change.HasIndex(c => c.MergedFromPartnerId);
        });

        builder.Entity<PartnerActivity>(activity =>
        {
            activity.ToTable("PartnerActivities");
            activity.Property(a => a.Id).ValueGeneratedNever();
            activity.Property(a => a.Kind).HasConversion<string>().HasMaxLength(16);
            activity.Property(a => a.FromStage).HasMaxLength(PartnerStage.MaxName);
            activity.Property(a => a.ToStage).HasMaxLength(PartnerStage.MaxName);
            activity.Property(a => a.Summary).HasMaxLength(2000);
            activity.Property(a => a.NextStep).HasMaxLength(200);
            activity.HasIndex(a => new { a.PartnerId, a.OccurredOn, a.OccurredAt, a.LoggedAtUtc });
            activity.HasIndex(a => a.PartnerId, "IX_PartnerActivities_PartnerId_NextStep").HasFilter("\"NextStep\" IS NOT NULL");
            activity.HasIndex(a => a.StageChangeId);
            activity.HasIndex(a => a.MergedFromPartnerId);
            activity.HasOne<Partner>().WithMany().HasForeignKey(a => a.PartnerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PartnerDuplicateDismissal>(dismissal =>
        {
            dismissal.ToTable("PartnerDuplicateDismissals");
            dismissal.Property(d => d.Id).ValueGeneratedNever();
            dismissal.HasIndex(d => new { d.OrganisationId, d.LowerPartnerId, d.HigherPartnerId }).IsUnique();
            dismissal.HasIndex(d => d.HigherPartnerId);
            dismissal.HasOne<Partner>().WithMany().HasForeignKey(d => d.LowerPartnerId).OnDelete(DeleteBehavior.Cascade);
            dismissal.HasOne<Partner>().WithMany().HasForeignKey(d => d.HigherPartnerId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureAgile(builder);

        builder.Entity<Event>(ev =>
        {
            ev.Property(e => e.Id).ValueGeneratedNever();
            ev.Property(e => e.Title).HasMaxLength(200);
            ev.Property(e => e.Description).HasMaxLength(4000);
            ev.HasOne(e => e.Type).WithMany().HasForeignKey(e => e.TypeId).OnDelete(DeleteBehavior.Restrict);
            ev.Navigation(e => e.Type).AutoInclude();
            ev.HasOne(e => e.Chapter).WithMany().HasForeignKey(e => e.ChapterId).OnDelete(DeleteBehavior.Restrict);
            ev.HasIndex(e => e.ChapterId);
            ev.Navigation(e => e.Chapter).AutoInclude();
            ev.Property(e => e.Format).HasConversion<string>().HasMaxLength(16);
            ev.Property(e => e.Venue).HasMaxLength(300);
            ev.Property(e => e.OnlineLink).HasMaxLength(500);
            ev.Property(e => e.Visibility).HasConversion<string>().HasMaxLength(16);
            ev.Property(e => e.CancellationReason).HasMaxLength(500);
            ev.Ignore(e => e.RsvpCount);
            ev.Ignore(e => e.IsFull);
            ev.Ignore(e => e.CheckedInCount);
            ev.Ignore(e => e.AttendeeCount);
            ev.Ignore(e => e.CheckInOpensAt);
            ev.HasIndex(e => e.StartsAt);
            ev.HasMany(e => e.Rsvps).WithOne().HasForeignKey(r => r.EventId).OnDelete(DeleteBehavior.Cascade);
            ev.Navigation(e => e.Rsvps).HasField("_rsvps").UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<Rsvp>(rsvp =>
        {
            rsvp.ToTable("Rsvps");
            rsvp.Property(r => r.Id).ValueGeneratedNever();
            rsvp.Property(r => r.GuestName).HasMaxLength(200);
            rsvp.Property(r => r.GuestEmail).HasMaxLength(256);
            rsvp.Ignore(r => r.IsGuest);
            rsvp.Ignore(r => r.IsCheckedIn);
            rsvp.Property(r => r.CancelTokenHash).HasMaxLength(64);
            rsvp.HasIndex(r => r.CancelTokenHash).IsUnique().HasFilter("\"CancelTokenHash\" IS NOT NULL");
            rsvp.HasIndex(r => new { r.EventId, r.ProfileId }).IsUnique().HasFilter("\"ProfileId\" IS NOT NULL");
            rsvp.HasIndex(r => new { r.EventId, r.GuestEmail });
        });

        ConfigureAnnouncements(builder);
        ConfigureResources(builder);
        ConfigureNotes(builder);

        // Full-text search columns exist only in PostgreSQL; the in-memory test database has none (ADR 0016).
        if (Database.IsNpgsql())
        {
            SearchVectors.Configure(builder);
        }

        // A profile is an account's membership of one organisation: at most one per account per organisation (ADR 0032).
        builder.Entity<Profile>()
            .HasOne<CommunityUser>()
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Profile>()
            .HasIndex(p => new { p.OrganisationId, p.UserId })
            .IsUnique()
            .HasFilter("\"UserId\" IS NOT NULL");

        ScopeToOrganisation(builder);
    }

    /// <summary>
    /// Every organisation-scoped record gets a required, indexed OrganisationId that references its organisation, and a
    /// named query filter on the current organisation, so every query runs the predicate in SQL (L2-130 AC2) and an id
    /// from another organisation is not found (AC3). Named, so lifting the archived filter never lifts this one.
    /// </summary>
    private void ScopeToOrganisation(ModelBuilder builder)
    {
        foreach (var entity in builder.Model.GetEntityTypes()
            .Where(e => !e.IsOwned() && typeof(IOrganisationScoped).IsAssignableFrom(e.ClrType)).ToList())
        {
            var type = builder.Entity(entity.ClrType);
            type.HasOne(typeof(Organisation)).WithMany().HasForeignKey(nameof(IOrganisationScoped.OrganisationId)).OnDelete(DeleteBehavior.Restrict);
            type.HasIndex(nameof(IOrganisationScoped.OrganisationId));

            var record = Expression.Parameter(entity.ClrType, "record");
            var filter = Expression.Lambda(
                Expression.Equal(
                    Expression.Property(record, nameof(IOrganisationScoped.OrganisationId)),
                    Expression.Property(Expression.Constant(this), nameof(CurrentOrganisationId))),
                record);
            type.HasQueryFilter(QueryFilters.Organisation, filter);
        }
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampOrganisation();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampOrganisation();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>
    /// Stamps every added record with the current organisation, and refuses one that names another, so no request can
    /// write into an organisation it is not on (L2-130 AC1).
    /// </summary>
    private void StampOrganisation()
    {
        foreach (var entry in ChangeTracker.Entries<IOrganisationScoped>())
        {
            var property = entry.Property(e => e.OrganisationId);
            if (entry.State == EntityState.Added && property.CurrentValue == Guid.Empty)
            {
                property.CurrentValue = _organisation.Id;
            }
            else if (entry.State is EntityState.Added or EntityState.Modified && property.CurrentValue != _organisation.Id)
            {
                throw new InvalidOperationException(
                    $"A {entry.Metadata.ClrType.Name} of another organisation cannot be written in this one.");
            }
        }
    }

    private static OrganisationScope DefaultScope()
    {
        var scope = new OrganisationScope();
        scope.RunAs(FaithTechSeed.OrganisationId);
        return scope;
    }

    private static void ConfigureResources(ModelBuilder builder)
    {
        builder.Entity<Resource>(resource =>
        {
            resource.Property(r => r.Id).ValueGeneratedNever();
            resource.Property(r => r.Title).HasMaxLength(Resource.MaxTitle);
            resource.Property(r => r.Description).HasMaxLength(Resource.MaxDescription);
            resource.HasOne(r => r.Type).WithMany().HasForeignKey(r => r.TypeId).OnDelete(DeleteBehavior.Restrict);
            resource.Navigation(r => r.Type).AutoInclude();
            resource.Property(r => r.Visibility).HasConversion<string>().HasMaxLength(16);
            resource.Property(r => r.OwnerRole).HasMaxLength(32);
            resource.Property(r => r.LinkUrl).HasMaxLength(2000);
            resource.Property(r => r.LinkHost).HasMaxLength(255);
            resource.Property(r => r.TagText).HasMaxLength(2000);
            resource.Ignore(r => r.IsArchived);
            resource.Ignore(r => r.IsLink);
            resource.Ignore(r => r.PurgeAt);
            resource.HasIndex(r => new { r.ArchivedAt, r.AddedAt });
            resource.HasIndex(r => r.OwnerId);
            resource.OwnsOne(r => r.File, file =>
            {
                file.Property(f => f.FileName).HasMaxLength(255);
                file.Property(f => f.Extension).HasMaxLength(8);
                file.Property(f => f.ContentType).HasMaxLength(100);
                file.Property(f => f.BlobName).HasMaxLength(200);
                file.Property(f => f.ThumbnailBlobName).HasMaxLength(200);
            });
            resource.OwnsMany(r => r.Tags, tag =>
            {
                tag.ToTable("ResourceTags");
                tag.WithOwner().HasForeignKey(t => t.ResourceId);
                tag.HasKey(t => new { t.ResourceId, t.Tag });
                tag.Property(t => t.Tag).HasMaxLength(Resource.MaxTag);
                tag.HasIndex(t => t.Tag);
            });
            resource.Navigation(r => r.Tags).HasField("_tags").UsePropertyAccessMode(PropertyAccessMode.Field);
            resource.OwnsMany(r => r.SharedMembers, member =>
            {
                member.ToTable("ResourceShareMembers");
                member.WithOwner().HasForeignKey(m => m.ResourceId);
                member.HasKey(m => new { m.ResourceId, m.ProfileId });
                member.HasIndex(m => m.ProfileId);
            });
            resource.Navigation(r => r.SharedMembers).HasField("_members").UsePropertyAccessMode(PropertyAccessMode.Field);
            resource.OwnsMany(r => r.SharedRoles, role =>
            {
                role.ToTable("ResourceShareRoles");
                role.WithOwner().HasForeignKey(x => x.ResourceId);
                role.HasKey(x => new { x.ResourceId, x.RoleDefinitionId });
                role.HasOne(x => x.Definition).WithMany().HasForeignKey(x => x.RoleDefinitionId).OnDelete(DeleteBehavior.Restrict);
                role.Navigation(x => x.Definition).AutoInclude();
            });
            resource.Navigation(r => r.SharedRoles).HasField("_roles").UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<ResourceBlobTask>(task =>
        {
            task.Property(t => t.Work).HasConversion<string>().HasMaxLength(16);
            task.Property(t => t.BlobName).HasMaxLength(200);
            task.Property(t => t.ContentType).HasMaxLength(100);
            task.HasIndex(t => t.NextAttemptAt);
            task.HasIndex(t => t.ResourceId);
        });
    }

    private static void ConfigureNotes(ModelBuilder builder)
    {
        builder.Entity<NotePage>(page =>
        {
            page.Property(p => p.Id).ValueGeneratedNever();
            page.Property(p => p.Title).HasMaxLength(NotePage.MaxTitle);
            page.Property(p => p.Icon).HasMaxLength(NotePage.MaxIcon);
            page.Property(p => p.Visibility).HasConversion<string>().HasMaxLength(16);
            page.Property(p => p.Version).IsConcurrencyToken();
            page.Ignore(p => p.IsArchived);
            page.HasIndex(p => new { p.ArchivedAt, p.UpdatedAt });
            page.HasIndex(p => p.OwnerId);
            page.HasIndex(p => p.ParentId);
            page.OwnsMany(p => p.SharedMembers, member =>
            {
                // A generated key, so a member added to a loaded page is inserted, not updated.
                member.ToTable("NoteShareMembers");
                member.WithOwner().HasForeignKey(m => m.PageId);
                member.Property<int>("Id").ValueGeneratedOnAdd();
                member.HasKey("Id");
                member.HasIndex(m => new { m.PageId, m.ProfileId }).IsUnique();
                member.HasIndex(m => m.ProfileId);
            });
            page.Navigation(p => p.SharedMembers).HasField("_members").UsePropertyAccessMode(PropertyAccessMode.Field);
            page.OwnsMany(p => p.SharedRoles, role =>
            {
                role.ToTable("NoteShareRoles");
                role.WithOwner().HasForeignKey(x => x.PageId);
                role.Property<int>("Id").ValueGeneratedOnAdd();
                role.HasKey("Id");
                role.HasIndex(x => new { x.PageId, x.RoleDefinitionId }).IsUnique();
                role.HasOne(x => x.Definition).WithMany().HasForeignKey(x => x.RoleDefinitionId).OnDelete(DeleteBehavior.Restrict);
                role.Navigation(x => x.Definition).AutoInclude();
            });
            page.Navigation(p => p.SharedRoles).HasField("_roles").UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<NoteLink>(link =>
        {
            link.HasKey(l => new { l.SourceId, l.TargetId });
            link.HasIndex(l => l.TargetId);
        });

        builder.Entity<NoteImage>(image =>
        {
            image.Property(i => i.Id).ValueGeneratedNever();
            image.Property(i => i.BlobName).HasMaxLength(200);
            image.Property(i => i.ContentType).HasMaxLength(100);
            image.HasIndex(i => i.PageId);
        });
    }

    private static void ConfigureAnnouncements(ModelBuilder builder)
    {
        builder.Entity<Announcement>(announcement =>
        {
            announcement.Property(a => a.Id).ValueGeneratedNever();
            announcement.Property(a => a.Subject).HasMaxLength(200);
            announcement.Property(a => a.Body).HasMaxLength(5000);
            announcement.HasIndex(a => a.SentAt);
            announcement.HasIndex(a => a.SenderId);
            announcement.OwnsOne(a => a.Audience, audience =>
            {
                audience.Property(x => x.Kind).HasColumnName("AudienceKind").HasConversion<string>().HasMaxLength(16);
                audience.Property(x => x.EventId).HasColumnName("AudienceEventId");
                // The chosen role definitions, stored as their ids separated by commas.
                audience.Property(x => x.RoleIds).HasColumnName("AudienceRoles").HasMaxLength(2000)
                    .HasConversion(
                        roles => string.Join(',', roles.Select(r => r.ToString()).Order()),
                        value => value.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Guid.Parse).ToHashSet(),
                        new ValueComparer<IReadOnlySet<Guid>>(
                            (a, b) => a!.SetEquals(b!),
                            roles => roles.Aggregate(0, (hash, role) => hash ^ role.GetHashCode()),
                            roles => roles.ToHashSet()));
            });
            announcement.Navigation(a => a.Audience).IsRequired();
            announcement.OwnsMany(a => a.Recipients, recipient =>
            {
                recipient.ToTable("AnnouncementRecipients");
                recipient.WithOwner().HasForeignKey(r => r.AnnouncementId);
                recipient.HasKey(r => new { r.AnnouncementId, r.ProfileId });
                recipient.HasIndex(r => r.ProfileId);
            });
            announcement.Navigation(a => a.Recipients).HasField("_recipients").UsePropertyAccessMode(PropertyAccessMode.Field);
        });
    }

    // Archived workspaces and work items are hidden from every normal view (L2-037 AC1, ADR 0011).
    private static void ConfigureAgile(ModelBuilder builder)
    {
        builder.Entity<Workspace>(workspace =>
        {
            workspace.Property(w => w.Id).ValueGeneratedNever();
            workspace.Property(w => w.Name).HasMaxLength(100);
            workspace.Property(w => w.Method).HasConversion<string>().HasMaxLength(16);
            workspace.HasIndex(w => w.OwnerId);
            workspace.HasQueryFilter(QueryFilters.Archived, w => !w.IsArchived);
            workspace.OwnsMany(w => w.Members, member =>
            {
                member.ToTable("WorkspaceMembers");
                member.WithOwner().HasForeignKey(m => m.WorkspaceId);
                // A generated shadow key, so EF sees a member added to a loaded workspace as new rather than modified.
                member.Property<int>("Id").ValueGeneratedOnAdd();
                member.HasKey("Id");
                member.HasIndex(m => new { m.WorkspaceId, m.ProfileId }).IsUnique();
                member.HasIndex(m => m.ProfileId);
            });
        });

        builder.Entity<WorkItem>(item =>
        {
            item.Property(i => i.Id).ValueGeneratedNever();
            item.Property(i => i.Kind).HasConversion<string>().HasMaxLength(16);
            item.Property(i => i.Status).HasConversion<string>().HasMaxLength(16);
            item.Property(i => i.Title).HasMaxLength(WorkItem.MaxTitleLength);
            item.Property(i => i.Description).HasMaxLength(4000);
            item.HasIndex(i => i.WorkspaceId);
            item.HasIndex(i => i.ParentId);
            item.HasIndex(i => i.SprintId);
            item.HasIndex(i => i.AssigneeId);
            item.HasQueryFilter(QueryFilters.Archived, i => !i.IsArchived);
            item.OwnsMany(i => i.Comments, comment =>
            {
                comment.ToTable("WorkItemComments");
                comment.WithOwner().HasForeignKey(c => c.WorkItemId);
                comment.HasKey(c => c.Id);
                comment.Property(c => c.Id).ValueGeneratedNever();
                comment.Property(c => c.Body).HasMaxLength(2000);
            });
        });

        builder.Entity<Sprint>(sprint =>
        {
            sprint.Property(s => s.Id).ValueGeneratedNever();
            sprint.Property(s => s.Name).HasMaxLength(100);
            sprint.Property(s => s.Goal).HasMaxLength(200);
            sprint.Property(s => s.State).HasConversion<string>().HasMaxLength(16);
            sprint.HasIndex(s => s.WorkspaceId);
            // Backs the one-active-sprint rule (L2-035 AC1) alongside Workspace.StartSprint.
            sprint.HasIndex(s => s.WorkspaceId, "IX_Sprints_WorkspaceId_Active").IsUnique().HasFilter("\"State\" = 'Active'");
        });

        builder.Entity<PokerSession>(session =>
        {
            session.Property(s => s.Id).ValueGeneratedNever();
            session.Ignore(s => s.CurrentStoryId);
            session.Ignore(s => s.IsComplete);
            session.Ignore(s => s.VoterIds);
            session.HasIndex(s => s.WorkspaceId);
            session.OwnsMany(s => s.Votes, vote =>
            {
                vote.ToTable("PokerVotes");
                vote.WithOwner().HasForeignKey(v => v.SessionId);
                // A generated shadow key, as for workspace members: a vote added to a loaded session is new, not modified.
                vote.Property<int>("Id").ValueGeneratedOnAdd();
                vote.HasKey("Id");
                vote.HasIndex(v => new { v.SessionId, v.ProfileId }).IsUnique();
                vote.Property(v => v.Value).HasConversion<string>().HasMaxLength(16);
            });
        });
    }
}
