using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Common;

public interface IApplicationDbContext
{
    DbSet<Profile> Profiles { get; }

    DbSet<CommunityUser> Users { get; }

    DbSet<AuditEntry> AuditEntries { get; }

    DbSet<Notification> Notifications { get; }

    DbSet<Invite> Invites { get; }

    DbSet<Contact> Contacts { get; }

    DbSet<ContactNote> ContactNotes { get; }

    DbSet<Partner> Partners { get; }

    DbSet<PartnerStageChange> PartnerStageChanges { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
