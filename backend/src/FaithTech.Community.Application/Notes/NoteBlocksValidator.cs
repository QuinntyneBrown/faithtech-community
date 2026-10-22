using FaithTech.Community.Domain.Notes;

namespace FaithTech.Community.Application.Notes;

/// <summary>The rules a whole-page save must meet (L2-086 AC11, L2-087); a save that breaks any is refused whole.</summary>
public static class NoteBlocksValidator
{
    public const int MaxBlocks = 500;
    public const int MaxText = 10_000;
    public const int MaxBlockId = 36;

    public static Dictionary<string, string[]> Check(IReadOnlyList<NoteBlock> blocks)
    {
        var errors = new Dictionary<string, string[]>();
        if (blocks.Count > MaxBlocks)
        {
            errors["Blocks"] = [$"A page holds up to {MaxBlocks} blocks. Start a new page inside this one."];
            return errors;
        }

        var ids = new HashSet<string>();
        for (var i = 0; i < blocks.Count; i++)
        {
            if (Problem(blocks[i], ids) is { } problem)
            {
                errors[$"Blocks[{i}]"] = [problem];
            }
        }

        return errors;
    }

    private static string? Problem(NoteBlock block, HashSet<string> ids)
    {
        if (string.IsNullOrWhiteSpace(block.Id) || block.Id.Length > MaxBlockId || !ids.Add(block.Id))
        {
            return "Each block needs its own id.";
        }

        if (!NoteBlockTypes.All.Contains(block.Type ?? string.Empty))
        {
            return "Choose a block type from the list.";
        }

        var spans = block.Text ?? [];
        if (spans.Any(s => s is null || s.Text is null))
        {
            return "Each run of text needs its text.";
        }

        if (spans.Sum(s => s.Text.Length) > MaxText)
        {
            return $"A block holds up to {MaxText:N0} characters.";
        }

        return null;
    }

    /// <summary>The page's searchable text: the title and the blocks' own text, never linked pages' titles (L2-096 AC3).</summary>
    public static string BodyText(IReadOnlyList<NoteBlock> blocks) =>
        string.Join('\n', blocks.Select(b => string.Concat((b.Text ?? []).Where(s => s.PageId is null).Select(s => s.Text)) + (b.Caption is { } c ? " " + c : "")).Where(t => t.Length > 0));
}
