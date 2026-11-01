namespace FaithTech.Community.Domain.Organisations;

/// <summary>Where an operator acted from: the operator API or the Cli's <c>org</c> commands.</summary>
public enum PlatformAuditSource
{
    Api,
    Cli,
}

/// <summary>
/// One platform operator action (L2-148 AC4). It belongs to no organisation: it is not <see cref="IOrganisationScoped"/>,
/// so it never appears on an organisation's audit log (L2-152 AC4), and only the platform audit reads it.
/// </summary>
public class PlatformAuditEntry
{
    private PlatformAuditEntry() { }

    public PlatformAuditEntry(
        string operatorEmail,
        PlatformAuditSource source,
        string action,
        string? organisationSlug,
        string target,
        string? detailsJson,
        DateTime occurredAtUtc)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(operatorEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        ArgumentException.ThrowIfNullOrWhiteSpace(target);
        if (occurredAtUtc.Kind != DateTimeKind.Utc)
        {
            throw new ArgumentException("The time must be in UTC.", nameof(occurredAtUtc));
        }

        Id = Guid.NewGuid();
        OperatorEmail = operatorEmail;
        Source = source;
        Action = action;
        OrganisationSlug = organisationSlug;
        Target = target;
        DetailsJson = detailsJson;
        OccurredAtUtc = occurredAtUtc;
    }

    public Guid Id { get; private set; }

    public string OperatorEmail { get; private set; } = string.Empty;

    public PlatformAuditSource Source { get; private set; }

    /// <summary>organisation.provisioned, organisation.suspended, organisation.lifted, account.locked or account.unlocked.</summary>
    public string Action { get; private set; } = string.Empty;

    /// <summary>The organisation acted on; null for an account action.</summary>
    public string? OrganisationSlug { get; private set; }

    /// <summary>The slug or the email acted on.</summary>
    public string Target { get; private set; } = string.Empty;

    public string? DetailsJson { get; private set; }

    public DateTime OccurredAtUtc { get; private set; }
}
