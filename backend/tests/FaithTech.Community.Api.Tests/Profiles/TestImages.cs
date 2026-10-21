using System.Text;
using SkiaSharp;

namespace FaithTech.Community.Api.Tests.Profiles;

/// <summary>Real images, made in memory, as a member's camera or phone would produce them.</summary>
public static class TestImages
{
    public const string CameraMake = "PhoneCo";

    public static byte[] Jpeg(int width = 64, int height = 48) => Encode(width, height, SKEncodedImageFormat.Jpeg);

    public static byte[] Png(int width = 64, int height = 48) => Encode(width, height, SKEncodedImageFormat.Png);

    public static byte[] Webp(int width = 64, int height = 48) => Encode(width, height, SKEncodedImageFormat.Webp);

    /// <summary>A JPEG carrying an EXIF block with the camera make and an orientation tag (6 = rotate 90° clockwise).</summary>
    public static byte[] JpegWithExif(int width, int height, ushort orientation = 1)
    {
        var jpeg = Jpeg(width, height);
        var exif = ExifSegment(orientation);
        // Insert the APP1 segment straight after the start-of-image marker.
        return [.. jpeg[..2], .. exif, .. jpeg[2..]];
    }

    public static (int Width, int Height) Size(byte[] image)
    {
        using var bitmap = SKBitmap.Decode(image);
        return (bitmap.Width, bitmap.Height);
    }

    private static byte[] Encode(int width, int height, SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(width, height);
        bitmap.Erase(new SKColor(120, 90, 200));
        using var image = SKImage.FromBitmap(bitmap);
        return image.Encode(format, 90).ToArray();
    }

    private static byte[] ExifSegment(ushort orientation)
    {
        // Little-endian TIFF: header, one IFD with Make (ASCII) and Orientation (SHORT), then the make text.
        var make = Encoding.ASCII.GetBytes(CameraMake + "\0");
        using var tiff = new MemoryStream();
        using (var w = new BinaryWriter(tiff, Encoding.ASCII, leaveOpen: true))
        {
            w.Write("II"u8);
            w.Write((ushort)42);
            w.Write(8u);
            w.Write((ushort)2);
            w.Write((ushort)0x010F); w.Write((ushort)2); w.Write((uint)make.Length); w.Write(8u + 2 + 12 * 2 + 4);
            w.Write((ushort)0x0112); w.Write((ushort)3); w.Write(1u); w.Write(orientation); w.Write((ushort)0);
            w.Write(0u);
            w.Write(make);
        }

        var payload = (byte[])[.. "Exif\0\0"u8, .. tiff.ToArray()];
        var length = payload.Length + 2;
        return [0xFF, 0xE1, (byte)(length >> 8), (byte)length, .. payload];
    }
}
