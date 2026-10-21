namespace FaithTech.Community.Application.Admin;

/// <summary>
/// Records an action in the audit log (L2-041). The entry is added to the current unit of work and is
/// saved with the change it records.
/// </summary>
public interface IAuditLog
{
    void Record(Guid actorId, string action, string targetType, string targetId, object? before, object? after);
}
