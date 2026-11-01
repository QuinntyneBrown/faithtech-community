namespace FaithTech.Community.Domain.Events;

/// <summary>Whether a hub can be seen beyond its managers (L2-153; publishing arrives with slice 43).</summary>
public enum EventHubStatus
{
    Draft,
    Published,
}
