using FaithTech.Community.Domain.Notes;

namespace FaithTech.Community.Application.Notes;

/// <summary>The rules a whole-page save must meet (L2-086 AC11, L2-087); a save that breaks any is refused whole.</summary>
public static class NoteBlocksValidator
{
    public const int MaxBlocks = 500;
    public const int MaxText = 10_000;
    public const int MaxBlockId = 36;
    public const int MaxUrl = 2000;
    public const int MaxCaption = 200;
    public const string LinkCardMessage = "Use a link that starts with https://.";
    public const string HyperlinkMessage = "Use a link that starts with https:// or mailto:";

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

        if (spans.Any(s => s.Href is not null && !IsHyperlink(s.Href)))
        {
            return HyperlinkMessage;
        }

        if (spans.Sum(s => s.Text.Length) > MaxText)
        {
            return $"A block holds up to {MaxText:N0} characters.";
        }

        return block.Type switch
        {
            NoteBlockTypes.Link when !IsHttps(block.Url) => LinkCardMessage,
            NoteBlockTypes.Link when block.Caption?.Length > MaxCaption => $"Use {MaxCaption} characters or fewer for the caption.",
            NoteBlockTypes.Callout when block.Icon is not null && !NoteFields.IsEmoji(block.Icon) => "Choose a single emoji for the icon.",
            _ => null,
        };
    }

    /// <summary>An https or mailto link of at most 2,000 characters (L2-088 AC3).</summary>
    public static bool IsHyperlink(string value) =>
        IsHttps(value)
        || (value.Length <= MaxUrl && value.StartsWith("mailto:", StringComparison.Ordinal)
            && Uri.TryCreate(value, UriKind.Absolute, out var mail) && mail.Scheme == Uri.UriSchemeMailto);

    /// <summary>An absolute https URL of at most 2,000 characters (L2-087 AC9).</summary>
    public static bool IsHttps(string? value) =>
        value is { Length: > 0 and <= MaxUrl }
        && Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && !string.IsNullOrEmpty(uri.Host);

    /// <summary>The page's searchable text: the title and the blocks' own text, never linked pages' titles (L2-096 AC3).</summary>
    public static string BodyText(IReadOnlyList<NoteBlock> blocks) =>
        string.Join('\n', blocks.Select(b => string.Concat((b.Text ?? []).Where(s => s.PageId is null).Select(s => s.Text)) + (b.Caption is { } c ? " " + c : "")).Where(t => t.Length > 0));
}
