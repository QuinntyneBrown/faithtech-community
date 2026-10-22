namespace FaithTech.Community.Application.Profiles;

/// <summary>A photo ready to store: resized, stripped of metadata and re-encoded in its own format.</summary>
public record ProcessedImage(byte[] Content, string ContentType, string Extension);

/// <summary>The processed photo, or why the file was refused (worded for the member, naming the file).</summary>
public record ImageProcessingResult(ProcessedImage? Image, string? Error);

/// <summary>Checks a photo's real format against its file name, then resizes it and strips metadata (ADR 0001).</summary>
public interface IImageProcessor
{
    Task<ImageProcessingResult> ProcessAsync(Stream content, string fileName, CancellationToken cancellationToken = default);

    /// <summary>A PNG fitted inside <paramref name="maxEdge"/>, upright, for a resource image (ADR 0017); null if it cannot be decoded.</summary>
    Task<byte[]?> ThumbnailAsync(Stream content, int maxEdge, CancellationToken cancellationToken = default);
}
