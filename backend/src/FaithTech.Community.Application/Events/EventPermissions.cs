using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>Who may do what with events, read from the caller's roles (L2-020, L2-022, L2-025).</summary>
public class EventPermissions(ICurrentUser current)
{
    private static readonly Role[] Managers = [Role.EventLead, Role.CityLead, Role.SystemAdmin];
    private static readonly Role[] Leads = [Role.CityLead, Role.EventLead, Role.CreateLead, Role.CommunicationsLead];

    /// <summary>Event Leads, City Leads and System Admins create, edit and cancel events.</summary>
    public bool CanManageEvents => Managers.Any(current.HasRole);

    /// <summary>Leads, Staff and System Admins see who RSVP'd; everyone else sees the count (L2-022 AC3, AC4).</summary>
    public bool CanSeeRsvpList => Leads.Any(current.HasRole) || current.HasRole(Role.Staff) || current.HasRole(Role.SystemAdmin);

    /// <summary>Guest emails are for leads and System Admins only, not Staff (L2-022 AC4).</summary>
    public bool CanSeeGuestEmails => Leads.Any(current.HasRole) || current.HasRole(Role.SystemAdmin);

    /// <summary>Leads and System Admins export the RSVP list as CSV (L2-022 AC5).</summary>
    public bool CanExportRsvps => CanSeeGuestEmails;

    /// <summary>Lead roles and System Admins check attendees in, undo, add walk-ins and export (L2-117 AC1).</summary>
    public bool CanCheckIn => CanSeeGuestEmails;

    /// <summary>Staff also open the check-in page, read-only (L2-117 AC2).</summary>
    public bool CanViewCheckIn => CanSeeRsvpList;

    /// <summary>A System Admin checking in without a lead role is overriding, and is audited (L2-117 AC5).</summary>
    public bool IsCheckInOverride => current.HasRole(Role.SystemAdmin) && !Leads.Any(current.HasRole);

    /// <summary>A System Admin acting without an event role is overriding, and is audited.</summary>
    public bool IsAdminOverride =>
        current.HasRole(Role.SystemAdmin) && !current.HasRole(Role.EventLead) && !current.HasRole(Role.CityLead);

    /// <summary>The caller's profile id, or null for an anonymous caller or an unknown account.</summary>
    public Task<Guid?> CallerProfileIdAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(current.ProfileId);
}
