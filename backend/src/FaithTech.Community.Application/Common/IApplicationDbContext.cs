using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Common;

public interface IApplicationDbContext
{
    DbSet<Profile> Profiles { get; }

    DbSet<CommunityUser> Users { get; }

    DbSet<AuditEntry> AuditEntries { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
