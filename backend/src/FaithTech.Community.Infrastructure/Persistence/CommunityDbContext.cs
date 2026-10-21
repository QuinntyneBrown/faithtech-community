using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Profiles;
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

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.UseOpenIddict();

        builder.Entity<Profile>(profile =>
        {
            profile.Property(p => p.Name).HasMaxLength(200);
            profile.PrimitiveCollection(p => p.Roles).ElementType().HasConversion<string>();
        });

        builder.Entity<VerificationResend>(resend =>
        {
            resend.Property(r => r.NormalizedEmail).HasMaxLength(256);
            resend.HasIndex(r => new { r.NormalizedEmail, r.RequestedAt });
        });

        builder.Entity<CommunityUser>()
            .HasOne<Profile>()
            .WithOne()
            .HasForeignKey<CommunityUser>(u => u.ProfileId);
    }
}
