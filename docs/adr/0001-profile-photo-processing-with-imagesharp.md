# 0001. Process profile photos with ImageSharp

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-007
- Design: `docs/detailed-designs/profiles/manage-profile-photos`

## Context

L2-007 requires the server to accept JPEG, PNG and WebP photos of 5 MB or less, reject files whose content does not match their extension, resize them and remove metadata (EXIF, including location) before they are stored. The design left the resize dimensions `<TO SUPPLY>`. The API runs in a Linux container and the backend tests must not depend on external services.

## Decision

- `IImageProcessor` is an Application abstraction. `ImageSharpImageProcessor` in `Infrastructure/Storage/` implements it with **SixLabors.ImageSharp** (fully managed, no native libraries).
- The real format is detected from the file's bytes (`Image.DetectFormat`), never from the declared content type. The extension must map to the same format: `.jpg`/`.jpeg` → JPEG, `.png` → PNG, `.webp` → WebP. Anything else is rejected with "Photos must be JPEG, PNG or WebP." and a mismatch with "This file isn’t really a … image."
- The image is auto-oriented from its EXIF orientation, then resized to fit inside **1600 × 1600** pixels (never upscaled), then every metadata profile (EXIF, IPTC, XMP, ICC) is removed. It is re-encoded in its original format.
- The processor is a pure in-process transformation, so the API tests use the real one; only blob storage is faked.

## Consequences

- One small managed dependency; no system packages in the container image.
- ImageSharp is distributed under the Six Labors Split License, which is free for open-source projects and for organisations under the revenue threshold. Revisit if FaithTech's use stops qualifying.
- 1600 px keeps the featured photo sharp on high-density screens while keeping files small; thumbnails are scaled by the browser. A separate thumbnail size is deferred until a page needs one.
