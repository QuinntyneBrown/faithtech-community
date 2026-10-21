namespace FaithTech.Community.Domain.Admin;

public class AuditEntry
{
    private AuditEntry() { }

    public AuditEntry(
        Guid actorId,
        string action,
        string targetType,
        string targetId,
        string? beforeJson,
        string? afterJson,
        DateTime occurredAtUtc,
        string ipAddress)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        ArgumentException.ThrowIfNullOrWhiteSpace(targetType);
        ArgumentException.ThrowIfNullOrWhiteSpace(targetId);
        if (occurredAtUtc.Kind != DateTimeKind.Utc)
        {
            throw new ArgumentException("The time must be in UTC.", nameof(occurredAtUtc));
        }

        Id = Guid.NewGuid();
        ActorId = actorId;
        Action = action;
        TargetType = targetType;
        TargetId = targetId;
        BeforeJson = beforeJson;
        AfterJson = afterJson;
        OccurredAtUtc = occurredAtUtc;
        IpAddress = ipAddress;
    }

    public Guid Id { get; private set; }

    public Guid ActorId { get; private set; }

    public string Action { get; private set; } = string.Empty;

    public string TargetType { get; private set; } = string.Empty;

    public string TargetId { get; private set; } = string.Empty;

    public string? BeforeJson { get; private set; }

    public string? AfterJson { get; private set; }

    public DateTime OccurredAtUtc { get; private set; }

    public string IpAddress { get; private set; } = string.Empty;
}
