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

    OrganisationStatus Status { get; }
}
