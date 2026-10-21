using System.Text.Json;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;

namespace FaithTech.Community.Infrastructure.Admin;

/// <summary>Adds audit entries to the community database, stamped with UTC time and the caller's IP address.</summary>
public class AuditLog(CommunityDbContext db, IHttpContextAccessor http, TimeProvider time) : IAuditLog
{
    public void Record(Guid actorId, string action, string targetType, string targetId, object? before, object? after) =>
        db.AuditEntries.Add(new AuditEntry(
            actorId,
            action,
            targetType,
            targetId,
            before is null ? null : JsonSerializer.Serialize(before),
            after is null ? null : JsonSerializer.Serialize(after),
            time.GetUtcNow().UtcDateTime,
            http.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "unknown"));
}
