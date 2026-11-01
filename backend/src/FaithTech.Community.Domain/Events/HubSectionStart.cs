namespace FaithTech.Community.Domain.Events;

/// <summary>What a starting point gives one section (ADR 0041): whether it is shown, and its content as JSON (null for empty).</summary>
public record HubSectionStart(HubSectionKind Kind, bool Visible, string? Content);
