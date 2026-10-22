namespace FaithTech.Community.Domain.Notes;

/// <summary>Who may open a note page (L2-092): its owner, its audience, or every signed-in member. New pages are Private.</summary>
public enum NoteVisibility
{
    Private,
    Shared,
    Global,
}
