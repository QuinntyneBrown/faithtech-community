namespace FaithTech.Community.Domain.Notes;

/// <summary>
/// One block of a page (L2-087). Text-bearing blocks hold <see cref="Text"/> spans; a to-do has <see cref="Checked"/>,
/// a callout an <see cref="Icon"/>, an image an <see cref="ImageId"/> and <see cref="Alt"/>, a link card a
/// <see cref="Url"/> and <see cref="Caption"/>. Blocks are stored together as JSON on the page (ADR 0023).
/// </summary>
public record NoteBlock(
    string Id,
    string Type,
    IReadOnlyList<NoteSpan>? Text = null,
    bool? Checked = null,
    string? Icon = null,
    string? Url = null,
    string? Caption = null,
    Guid? ImageId = null,
    string? Alt = null);

/// <summary>
/// A run of text with its marks. <see cref="Href"/> makes it a hyperlink; <see cref="PageId"/> makes it a page link,
/// stored without text and given the target's title, or "Private page", when it is read (ADR 0025).
/// </summary>
public record NoteSpan(
    string Text,
    bool? Bold = null,
    bool? Italic = null,
    bool? Underline = null,
    bool? Strike = null,
    bool? Code = null,
    string? Href = null,
    Guid? PageId = null);

public static class NoteBlockTypes
{
    public const string Paragraph = "paragraph";
    public const string Heading1 = "heading1";
    public const string Heading2 = "heading2";
    public const string Heading3 = "heading3";
    public const string Bulleted = "bulleted";
    public const string Numbered = "numbered";
    public const string Todo = "todo";
    public const string Quote = "quote";
    public const string Callout = "callout";
    public const string Code = "code";
    public const string Divider = "divider";
    public const string Image = "image";
    public const string Link = "link";

    /// <summary>The blocks that hold rich-text spans.</summary>
    public static readonly IReadOnlySet<string> WithText = new HashSet<string>
    {
        Paragraph, Heading1, Heading2, Heading3, Bulleted, Numbered, Todo, Quote, Callout, Code,
    };

    public static readonly IReadOnlySet<string> All = new HashSet<string>(WithText) { Divider, Image, Link };
}
