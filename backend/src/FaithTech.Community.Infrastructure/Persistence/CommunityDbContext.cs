using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Contacts;
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

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<Invite> Invites => Set<Invite>();

    public DbSet<Contact> Contacts => Set<Contact>();

    public DbSet<ContactNote> ContactNotes => Set<ContactNote>();

    public DbSet<Partner> Partners => Set<Partner>();

    public DbSet<PartnerStageChange> PartnerStageChanges => Set<PartnerStageChange>();

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
        });

        builder.Entity<VerificationResend>(resend =>
        {
            resend.Property(r => r.NormalizedEmail).HasMaxLength(256);
            resend.HasIndex(r => new { r.NormalizedEmail, r.RequestedAt });
        });

        builder.Entity<OutboxMessage>(message =>
        {
            message.Property(m => m.To).HasMaxLength(256);
            message.Property(m => m.Subject).HasMaxLength(300);
            message.Property(m => m.LastError).HasMaxLength(500);
            message.HasIndex(m => new { m.SentAt, m.NextAttemptAt });
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

        builder.Entity<CommunityUser>()
            .HasOne<Profile>()
            .WithOne()
            .HasForeignKey<CommunityUser>(u => u.ProfileId);
    }
}
