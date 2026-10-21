using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
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

        builder.Entity<CommunityUser>()
            .HasOne<Profile>()
            .WithOne()
            .HasForeignKey<CommunityUser>(u => u.ProfileId);
    }
}
