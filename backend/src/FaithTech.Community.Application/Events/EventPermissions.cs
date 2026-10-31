using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Events;

/// <summary>Who may do what with events, read from the caller's capabilities (L2-020, L2-022, L2-025, L2-135).</summary>
public class EventPermissions(ICurrentUser current)
{
    /// <summary>ManageEvents creates, edits and cancels events.</summary>
    public bool CanManageEvents => current.Has(Capability.ManageEvents);

    /// <summary>ViewAttendees or ManageAttendance see who RSVP'd; everyone else sees the count (L2-022 AC3, AC4).</summary>
    public bool CanSeeRsvpList => current.Has(Capability.ViewAttendees) || current.Has(Capability.ManageAttendance);

    /// <summary>Guest emails are for ManageAttendance only (L2-022 AC4).</summary>
    public bool CanSeeGuestEmails => current.Has(Capability.ManageAttendance);

    /// <summary>ManageAttendance exports the RSVP list as CSV (L2-022 AC5).</summary>
    public bool CanExportRsvps => CanSeeGuestEmails;

    /// <summary>ManageAttendance checks attendees in, undoes, adds walk-ins and exports (L2-117 AC1).</summary>
    public bool CanCheckIn => CanSeeGuestEmails;

    /// <summary>ViewAttendees also opens the check-in page, read-only (L2-117 AC2).</summary>
    public bool CanViewCheckIn => CanSeeRsvpList;

    /// <summary>Checking in only because of AdministerOrganisation is an override, and is audited (L2-117 AC5).</summary>
    public bool IsCheckInOverride => AuthorizationRules.IsOverride(current, Capability.ManageAttendance);

    /// <summary>Managing an event only because of AdministerOrganisation is an override, and is audited.</summary>
    public bool IsAdminOverride => AuthorizationRules.IsOverride(current, Capability.ManageEvents);

    /// <summary>The caller's profile id, or null for an anonymous caller or an unknown account.</summary>
    public Task<Guid?> CallerProfileIdAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(current.ProfileId);
}
