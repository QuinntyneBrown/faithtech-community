using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// The organisation the request host resolved to (ADR 0032). Handlers read it as they read ICurrentUser; only the
/// host decides it, never a token, header, cookie, query string or body.
/// </summary>
public interface ICurrentOrganisation
{
    Guid Id { get; }

    string Slug { get; }

    string Name { get; }

    string ShortName { get; }

    string Host { get; }

    /// <summary>
    /// The community app's origin, <c>https://{Host}</c>, that every link in an email, a notification or an <c>.ics</c>
    /// file is built on (L2-130 AC6). In Development <c>Platform:DefaultOrganisationOrigin</c> stands in for the default
    /// organisation's, so links keep working on localhost.
    /// </summary>
    string Origin { get; }

    /// <summary>What the organisation calls one chapter, or null when chapters are off.</summary>
    string? ChapterLabelSingular { get; }

    /// <summary>What the organisation calls several chapters, or null when chapters are off.</summary>
    string? ChapterLabelPlural { get; }

    OrganisationStatus Status { get; }
}
