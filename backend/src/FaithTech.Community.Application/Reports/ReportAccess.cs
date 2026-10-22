using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Reports;

/// <summary>
/// Reports are for Staff and System Admins (L2-098); every other member, the lead roles included, is refused.
/// Reading a report is not an admin action, so nothing is audited.
/// </summary>
public class ReportAccess(ICurrentUser current)
{
    public bool CanRead => current.HasRole(Role.Staff) || current.HasRole(Role.SystemAdmin);
}
