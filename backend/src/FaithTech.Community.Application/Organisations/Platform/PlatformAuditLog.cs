using System.Text.Json;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Organisations.Platform;

/// <summary>
/// The operator acting in this scope: set by the operator API's filter from the signed-in account, or by an <c>org</c>
/// command from its <c>--operator</c> option.
/// </summary>
public class PlatformActor
{
    public string? Email { get; private set; }

    public PlatformAuditSource Source { get; private set; }

    public void Set(string email, PlatformAuditSource source) => (Email, Source) = (email, source);
}

/// <summary>Records operator actions in the platform audit log, saved with the change they record (L2-148 AC4).</summary>
public interface IPlatformAuditLog
{
    void Record(string action, string? organisationSlug, string target, object? details);
}

public class PlatformAuditLog(IApplicationDbContext db, PlatformActor actor, TimeProvider time) : IPlatformAuditLog
{
    public void Record(string action, string? organisationSlug, string target, object? details) =>
        db.PlatformAuditEntries.Add(new PlatformAuditEntry(
            actor.Email ?? throw new InvalidOperationException("No platform operator is acting."),
            actor.Source,
            action,
            organisationSlug,
            target,
            details is null ? null : JsonSerializer.Serialize(details),
            time.GetUtcNow().UtcDateTime));
}
