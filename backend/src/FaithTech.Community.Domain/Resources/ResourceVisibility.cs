namespace FaithTech.Community.Domain.Resources;

/// <summary>Who may open a resource (L2-060): its owner, its audience, or every signed-in member.</summary>
public enum ResourceVisibility
{
    Private,
    Shared,
    Global,
}
