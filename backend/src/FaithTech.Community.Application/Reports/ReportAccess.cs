using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Reports;

/// <summary>
/// Reports are for ViewReports (L2-123, L2-135); every other member is refused.
/// Reading a report is not an admin action, so nothing is audited.
/// </summary>
public class ReportAccess(ICurrentUser current)
{
    public bool CanRead => current.Has(Capability.ViewReports);
}
