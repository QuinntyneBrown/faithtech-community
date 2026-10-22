using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Infrastructure.Persistence;

public class CommunityDbContext(DbContextOptions<CommunityDbContext> options)
    : IdentityDbContext<CommunityUser, IdentityRole<Guid>, Guid>(options), IApplicationDbContext
{
    public DbSet<Profile> Profiles => Set<Profile>();

    public DbSet<VerificationResend> VerificationResends => Set<VerificationResend>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();

    public DbSet<SystemAdminRoster> SystemAdminRosters => Set<SystemAdminRoster>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<Invite> Invites => Set<Invite>();

    public DbSet<Contact> Contacts => Set<Contact>();

    public DbSet<ContactNote> ContactNotes => Set<ContactNote>();

    public DbSet<Partner> Partners => Set<Partner>();

    public DbSet<PartnerStageChange> PartnerStageChanges => Set<PartnerStageChange>();

    public DbSet<Workspace> Workspaces => Set<Workspace>();

    public DbSet<WorkItem> WorkItems => Set<WorkItem>();

    public DbSet<Sprint> Sprints => Set<Sprint>();

    public DbSet<PokerSession> PokerSessions => Set<PokerSession>();

    public DbSet<PhotoBlobTask> PhotoBlobTasks => Set<PhotoBlobTask>();
    public DbSet<Event> Events => Set<Event>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.UseOpenIddict();

        builder.Entity<Profile>(profile =>
        {
            profile.Property(p => p.Name).HasMaxLength(200);
            profile.Property(p => p.HomeCity).HasMaxLength(100);
            profile.Property(p => p.Bio).HasMaxLength(400);
            profile.Property(p => p.SuspendedReason).HasMaxLength(500);
            profile.Ignore(p => p.DomainEvents);
            profile.OwnsMany(p => p.Roles, role =>
            {
                role.ToTable("ProfileRoles");
                role.WithOwner().HasForeignKey(r => r.ProfileId);
                role.HasKey(r => new { r.ProfileId, r.Role });
                role.Property(r => r.Role).HasConversion<string>().HasMaxLength(32);
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

        builder.Entity<SystemAdminRoster>(roster =>
        {
            roster.Property(r => r.Id).ValueGeneratedNever();
            roster.Property(r => r.Version).IsConcurrencyToken();
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

        builder.Entity<Invite>(invite =>
        {
            invite.Property(i => i.Id).ValueGeneratedNever();
            invite.Property(i => i.Email).HasMaxLength(256);
            invite.Property(i => i.TokenHash).HasMaxLength(64);
            invite.HasIndex(i => i.TokenHash).IsUnique();
            invite.Property(i => i.PreassignedRole).HasConversion<string>().HasMaxLength(32);
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
            partner.Property(p => p.Stage).HasConversion<string>().HasMaxLength(16);
            partner.HasIndex(p => p.Stage);
            partner.HasMany(p => p.StageChanges).WithOne().HasForeignKey(c => c.PartnerId).OnDelete(DeleteBehavior.Cascade);
            partner.Navigation(p => p.StageChanges).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<PartnerStageChange>(change =>
        {
            change.ToTable("PartnerStageChanges");
            change.Property(c => c.Id).ValueGeneratedNever();
            change.Property(c => c.From).HasConversion<string>().HasMaxLength(16);
            change.Property(c => c.To).HasConversion<string>().HasMaxLength(16);
            change.Property(c => c.Note).HasMaxLength(500);
            change.HasIndex(c => new { c.PartnerId, c.MovedAtUtc });
        });

        ConfigureAgile(builder);

        builder.Entity<Event>(ev =>
        {
            ev.Property(e => e.Id).ValueGeneratedNever();
            ev.Property(e => e.Title).HasMaxLength(200);
            ev.Property(e => e.Description).HasMaxLength(4000);
            ev.Property(e => e.Type).HasConversion<string>().HasMaxLength(32);
            ev.Property(e => e.City).HasMaxLength(100);
            ev.Property(e => e.Format).HasConversion<string>().HasMaxLength(16);
            ev.Property(e => e.Venue).HasMaxLength(300);
            ev.Property(e => e.OnlineLink).HasMaxLength(500);
            ev.Property(e => e.Visibility).HasConversion<string>().HasMaxLength(16);
            ev.Property(e => e.CancellationReason).HasMaxLength(500);
            ev.Ignore(e => e.RsvpCount);
            ev.Ignore(e => e.IsFull);
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
            rsvp.Property(r => r.CancelTokenHash).HasMaxLength(64);
            rsvp.HasIndex(r => r.CancelTokenHash).IsUnique().HasFilter("\"CancelTokenHash\" IS NOT NULL");
            rsvp.HasIndex(r => new { r.EventId, r.ProfileId }).IsUnique().HasFilter("\"ProfileId\" IS NOT NULL");
            rsvp.HasIndex(r => new { r.EventId, r.GuestEmail });
        });

        builder.Entity<CommunityUser>()
            .HasOne<Profile>()
            .WithOne()
            .HasForeignKey<CommunityUser>(u => u.ProfileId);
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
            workspace.HasQueryFilter(w => !w.IsArchived);
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
            item.HasQueryFilter(i => !i.IsArchived);
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
