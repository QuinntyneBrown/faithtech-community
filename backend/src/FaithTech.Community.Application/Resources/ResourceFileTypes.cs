using System.Text;
using FaithTech.Community.Domain.Organisations;

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

    /// <summary>An allowed file: its content type, the resource type key it is guessed as (L2-146 AC3), its signature.</summary>
    private record FileKind(string ContentType, string TypeKey, Func<byte[], bool> Matches);

    private static readonly byte[] ZipHeader = [0x50, 0x4B, 0x03, 0x04];
    private static readonly byte[] OleHeader = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

    private static readonly Dictionary<string, FileKind> Kinds = new(StringComparer.OrdinalIgnoreCase)
    {
        ["pptx"] = new("application/vnd.openxmlformats-officedocument.presentationml.presentation", "deck", IsZip),
        ["ppt"] = new("application/vnd.ms-powerpoint", "deck", b => StartsWith(b, OleHeader)),
        ["key"] = new("application/vnd.apple.keynote", "deck", IsZip),
        ["pdf"] = new("application/pdf", "document", b => StartsWith(b, "%PDF-"u8.ToArray())),
        ["docx"] = new("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document", IsZip),
        ["doc"] = new("application/msword", "document", b => StartsWith(b, OleHeader)),
        ["xlsx"] = new("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "document", IsZip),
        ["csv"] = new("text/csv", "document", IsText),
        ["png"] = new("image/png", "image", b => StartsWith(b, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])),
        ["jpg"] = new("image/jpeg", "image", b => StartsWith(b, [0xFF, 0xD8, 0xFF])),
        ["svg"] = new("image/svg+xml", "logo", b => IsText(b) && Encoding.UTF8.GetString(b).Contains("<svg", StringComparison.OrdinalIgnoreCase)),
        ["gif"] = new("image/gif", "image", b => StartsWith(b, "GIF87a"u8.ToArray()) || StartsWith(b, "GIF89a"u8.ToArray())),
        ["webp"] = new("image/webp", "image", b => StartsWith(b, "RIFF"u8.ToArray()) && b.Length >= 12 && Encoding.ASCII.GetString(b, 8, 4) == "WEBP"),
        ["mp4"] = new("video/mp4", "other", b => b.Length >= 8 && Encoding.ASCII.GetString(b, 4, 4) == "ftyp"),
        ["zip"] = new("application/zip", "other", IsZip),
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

    /// <summary>The resource type key guessed from the extension; <see cref="ResourceTypeResolver"/> maps it to a type.</summary>
    public static string GuessType(string fileName) =>
        Kinds.TryGetValue(ExtensionOf(fileName), out var kind) ? kind.TypeKey : ResourceType.OtherKey;

    public static string ContentTypeOf(string fileName) =>
        Kinds.TryGetValue(ExtensionOf(fileName), out var kind) ? kind.ContentType : "application/octet-stream";

    /// <summary>Raster images get a thumbnail; SVG keeps its type icon (ADR 0017).</summary>
    public static bool HasThumbnail(string fileName) => ExtensionOf(fileName) is "png" or "jpg" or "gif" or "webp";

    private static bool IsZip(byte[] bytes) => StartsWith(bytes, ZipHeader);

    private static bool IsText(byte[] bytes) => bytes.Length > 0 && !bytes.Contains((byte)0);

    private static bool StartsWith(byte[] bytes, byte[] prefix) => bytes.AsSpan().StartsWith(prefix);
}
