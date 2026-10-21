# 0001. Process profile photos with SkiaSharp

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-007
- Design: `docs/detailed-designs/profiles/manage-profile-photos`

## Context

L2-007 requires the server to accept JPEG, PNG and WebP photos of 5 MB or less, reject files whose content does not match their extension, resize them and remove metadata (EXIF, including location) before they are stored. The design left the resize dimensions `<TO SUPPLY>`. The API runs in a Linux container and the backend tests must not depend on external services. The repository is MIT-licensed.

Options considered:

- **SixLabors.ImageSharp** — fully managed, but 3.x carries known high-severity advisories and 4.x needs a commercial license key at build time.
- **Magick.NET** — capable, but a large native dependency with a frequent advisory history.
- **SkiaSharp** — MIT, no known advisories, a small self-contained native library for Linux.

## Decision

- `IImageProcessor` is an Application abstraction. `SkiaImageProcessor` in `Infrastructure/Storage/` implements it with **SkiaSharp 4.153** and `SkiaSharp.NativeAssets.Linux.NoDependencies` (no system packages; needs a glibc base image).
- The real format is detected from the file's bytes (`SKCodec.EncodedFormat`), never from the declared content type. The extension must map to the same format: `.jpg`/`.jpeg` → JPEG, `.png` → PNG, `.webp` → WebP. Anything else is rejected with "… isn’t a photo we can use. Photos must be JPEG, PNG or WebP." and a mismatch with "… isn’t really a … image."
- The EXIF orientation is applied to the pixels, the image is resized to fit inside **1600 × 1600** pixels (never upscaled) and re-encoded from pixels in its original format (JPEG and WebP at quality 85). Re-encoding from pixels means EXIF (including location), XMP, IPTC and comments are never carried over.
- The processor is a pure in-process transformation, so the API tests use the real one; only blob storage is faked.

## Consequences

- One small native dependency, MIT-licensed.
- 1600 px keeps the featured photo sharp on high-density screens while keeping files small; thumbnails are scaled by the browser. A separate thumbnail size is deferred until a page needs one.
- Animated WebP keeps only its first frame.
