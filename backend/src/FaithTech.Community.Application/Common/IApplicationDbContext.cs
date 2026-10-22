using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Announcements;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Notes;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Common;

public interface IApplicationDbContext
{
    DbSet<Profile> Profiles { get; }

    DbSet<CommunityUser> Users { get; }

    DbSet<AuditEntry> AuditEntries { get; }

    DbSet<SystemAdminRoster> SystemAdminRosters { get; }

    DbSet<Notification> Notifications { get; }

    DbSet<Invite> Invites { get; }

    DbSet<ConnectLink> ConnectLinks { get; }

    DbSet<Contact> Contacts { get; }

    DbSet<PendingConnection> PendingConnections { get; }

    DbSet<ContactNote> ContactNotes { get; }

    DbSet<Partner> Partners { get; }

    DbSet<PartnerStageChange> PartnerStageChanges { get; }

    DbSet<Workspace> Workspaces { get; }

    DbSet<WorkItem> WorkItems { get; }

    DbSet<Sprint> Sprints { get; }

    DbSet<PokerSession> PokerSessions { get; }

    DbSet<PhotoBlobTask> PhotoBlobTasks { get; }
    DbSet<Event> Events { get; }

    DbSet<Announcement> Announcements { get; }

    DbSet<Resource> Resources { get; }

    DbSet<ResourceBlobTask> ResourceBlobTasks { get; }

    DbSet<NotePage> NotePages { get; }

    DbSet<NoteLink> NoteLinks { get; }

    DbSet<NoteImage> NoteImages { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
