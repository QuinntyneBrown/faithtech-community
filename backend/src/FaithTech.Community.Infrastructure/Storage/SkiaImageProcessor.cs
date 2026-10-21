using FaithTech.Community.Application.Profiles;
using SkiaSharp;

namespace FaithTech.Community.Infrastructure.Storage;

/// <summary>
/// Detects the real format, applies the EXIF orientation, fits inside 1600 × 1600 and re-encodes from pixels,
/// so EXIF (including location), XMP, IPTC and comments are never carried over (ADR 0001).
/// </summary>
public class SkiaImageProcessor : IImageProcessor
{
    public const int MaxEdge = 1600;
    private const int Quality = 85;

    private static readonly Dictionary<string, (SKEncodedImageFormat Format, string Name, string Extension, string ContentType)> Formats =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = (SKEncodedImageFormat.Jpeg, "JPEG", ".jpg", "image/jpeg"),
            [".jpeg"] = (SKEncodedImageFormat.Jpeg, "JPEG", ".jpg", "image/jpeg"),
            [".png"] = (SKEncodedImageFormat.Png, "PNG", ".png", "image/png"),
            [".webp"] = (SKEncodedImageFormat.Webp, "WebP", ".webp", "image/webp"),
        };

    public async Task<ImageProcessingResult> ProcessAsync(Stream content, string fileName, CancellationToken cancellationToken = default)
    {
        if (!Formats.TryGetValue(Path.GetExtension(fileName), out var expected))
        {
            return Rejected($"{fileName} isn’t a photo we can use. Photos must be JPEG, PNG or WebP.");
        }

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        using var data = SKData.CreateCopy(buffer.ToArray());
        using var codec = SKCodec.Create(data);
        using var decoded = codec is not null && codec.EncodedFormat == expected.Format ? SKBitmap.Decode(codec) : null;
        if (decoded is null)
        {
            return Rejected($"{fileName} isn’t really a {expected.Name} image. Choose a JPEG, PNG or WebP photo.");
        }

        using var oriented = Orient(decoded, codec!.EncodedOrigin);
        using var resized = FitInside(oriented);
        using var image = SKImage.FromBitmap(resized);
        using var encoded = image.Encode(expected.Format, Quality);
        return new ImageProcessingResult(new ProcessedImage(encoded.ToArray(), expected.ContentType, expected.Extension), null);
    }

    /// <summary>Draws the pixels the way the camera meant them to be seen, so the orientation tag can be dropped.</summary>
    private static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        if (origin == SKEncodedOrigin.TopLeft)
        {
            return source.Copy();
        }

        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var target = new SKBitmap(swap ? source.Height : source.Width, swap ? source.Width : source.Height);
        float w = target.Width, h = target.Height;
        using var canvas = new SKCanvas(target);
        switch (origin)
        {
            case SKEncodedOrigin.TopRight:
                canvas.Translate(w, 0);
                canvas.Scale(-1, 1);
                break;
            case SKEncodedOrigin.BottomRight:
                canvas.Translate(w, h);
                canvas.RotateDegrees(180);
                break;
            case SKEncodedOrigin.BottomLeft:
                canvas.Translate(0, h);
                canvas.Scale(1, -1);
                break;
            case SKEncodedOrigin.LeftTop:
                canvas.Scale(-1, 1);
                canvas.RotateDegrees(90);
                break;
            case SKEncodedOrigin.RightTop:
                canvas.Translate(w, 0);
                canvas.RotateDegrees(90);
                break;
            case SKEncodedOrigin.RightBottom:
                canvas.Translate(w, h);
                canvas.Scale(-1, 1);
                canvas.RotateDegrees(270);
                break;
            case SKEncodedOrigin.LeftBottom:
                canvas.Translate(0, h);
                canvas.RotateDegrees(270);
                break;
        }

        using var image = SKImage.FromBitmap(source);
        canvas.DrawImage(image, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest));
        return target;
    }

    private static SKBitmap FitInside(SKBitmap source)
    {
        var scale = Math.Min(1.0, (double)MaxEdge / Math.Max(source.Width, source.Height));
        if (scale >= 1.0)
        {
            return source.Copy();
        }

        var info = new SKImageInfo((int)Math.Round(source.Width * scale), (int)Math.Round(source.Height * scale));
        return source.Resize(info, new SKSamplingOptions(SKCubicResampler.Mitchell));
    }

    private static ImageProcessingResult Rejected(string error) => new(null, error);
}
