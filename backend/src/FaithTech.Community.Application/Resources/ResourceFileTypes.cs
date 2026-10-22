using System.Text;
using FaithTech.Community.Domain.Resources;

namespace FaithTech.Community.Application.Resources;

/// <summary>
/// The upload rules (L2-057 AC7, ADR 0017): an allowed extension, at most 100 MB, and leading bytes that match the
/// extension. Also the type guessed from an extension and the content type a download is sent with.
/// </summary>
public static class ResourceFileTypes
{
    public const long MaxBytes = 100L * 1024 * 1024;
    public const int MaxFiles = 20;

    /// <summary>How many leading bytes the signature check reads.</summary>
    public const int SniffLength = 64 * 1024;

    private record FileKind(string ContentType, ResourceType Type, Func<byte[], bool> Matches);

    private static readonly byte[] ZipHeader = [0x50, 0x4B, 0x03, 0x04];
    private static readonly byte[] OleHeader = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

    private static readonly Dictionary<string, FileKind> Kinds = new(StringComparer.OrdinalIgnoreCase)
    {
        ["pptx"] = new("application/vnd.openxmlformats-officedocument.presentationml.presentation", ResourceType.Deck, IsZip),
        ["ppt"] = new("application/vnd.ms-powerpoint", ResourceType.Deck, b => StartsWith(b, OleHeader)),
        ["key"] = new("application/vnd.apple.keynote", ResourceType.Deck, IsZip),
        ["pdf"] = new("application/pdf", ResourceType.Document, b => StartsWith(b, "%PDF-"u8.ToArray())),
        ["docx"] = new("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ResourceType.Document, IsZip),
        ["doc"] = new("application/msword", ResourceType.Document, b => StartsWith(b, OleHeader)),
        ["xlsx"] = new("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ResourceType.Document, IsZip),
        ["csv"] = new("text/csv", ResourceType.Document, IsText),
        ["png"] = new("image/png", ResourceType.Image, b => StartsWith(b, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])),
        ["jpg"] = new("image/jpeg", ResourceType.Image, b => StartsWith(b, [0xFF, 0xD8, 0xFF])),
        ["svg"] = new("image/svg+xml", ResourceType.Logo, b => IsText(b) && Encoding.UTF8.GetString(b).Contains("<svg", StringComparison.OrdinalIgnoreCase)),
        ["gif"] = new("image/gif", ResourceType.Image, b => StartsWith(b, "GIF87a"u8.ToArray()) || StartsWith(b, "GIF89a"u8.ToArray())),
        ["webp"] = new("image/webp", ResourceType.Image, b => StartsWith(b, "RIFF"u8.ToArray()) && b.Length >= 12 && Encoding.ASCII.GetString(b, 8, 4) == "WEBP"),
        ["mp4"] = new("video/mp4", ResourceType.Other, b => b.Length >= 8 && Encoding.ASCII.GetString(b, 4, 4) == "ftyp"),
        ["zip"] = new("application/zip", ResourceType.Other, IsZip),
    };

    public const string AllowedList = "PPTX, PPT, KEY, PDF, DOCX, DOC, XLSX, CSV, PNG, JPG, SVG, GIF, WEBP, MP4 or ZIP";

    public static string Refusal(string fileName) =>
        $"{fileName} can’t be added. Use {AllowedList}, up to 100 MB. For longer video, add a link instead.";

    /// <summary>"jpeg" is read as "jpg"; anything else is the extension without its dot, lower-cased.</summary>
    public static string ExtensionOf(string fileName)
    {
        var extension = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        return extension == "jpeg" ? "jpg" : extension;
    }

    public static bool IsAllowed(string fileName) => Kinds.ContainsKey(ExtensionOf(fileName));

    /// <summary>Whether the file may be added, judged by its extension, size and leading bytes.</summary>
    public static bool Accepts(string fileName, long length, byte[] leadingBytes) =>
        length is > 0 and <= MaxBytes && Kinds.TryGetValue(ExtensionOf(fileName), out var kind) && kind.Matches(leadingBytes);

    public static ResourceType GuessType(string fileName) =>
        Kinds.TryGetValue(ExtensionOf(fileName), out var kind) ? kind.Type : ResourceType.Other;

    public static string ContentTypeOf(string fileName) =>
        Kinds.TryGetValue(ExtensionOf(fileName), out var kind) ? kind.ContentType : "application/octet-stream";

    /// <summary>Raster images get a thumbnail; SVG keeps its type icon (ADR 0017).</summary>
    public static bool HasThumbnail(string fileName) => ExtensionOf(fileName) is "png" or "jpg" or "gif" or "webp";

    private static bool IsZip(byte[] bytes) => StartsWith(bytes, ZipHeader);

    private static bool IsText(byte[] bytes) => bytes.Length > 0 && !bytes.Contains((byte)0);

    private static bool StartsWith(byte[] bytes, byte[] prefix) => bytes.AsSpan().StartsWith(prefix);
}
