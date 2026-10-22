# 0017. Resources: storage, access and lifecycle

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-020, L2-055 to L2-066
- Designs: `docs/detailed-designs/resources/list-and-find`, `docs/detailed-designs/resources/add-and-edit`, `docs/detailed-designs/resources/share`, `docs/detailed-designs/resources/archive-and-transfer`
- Refines: ADR 0001, ADR 0002, ADR 0013, ADR 0016

## Context

Resources (L1-020) are decks, logos, images, training and templates that leads add as uploaded files or https links. The decisions in `docs/prompts/resources-prompt.md` are binding: uploads to Azure Blob behind a storage abstraction plus https links, 100 MB per file and a fixed list of extensions, Private / Shared / Global visibility with Global as the default, owner-only edits with an audited System Admin override, archive with a 30-day purge, image thumbnails from the SkiaSharp processor, a `ResourceShared` notification, a Resources group in global search, and Staff adding and owning resources as a deliberate carve-out from the Staff read-only rule.

Five details were left open: how files are stored next to photos, how downloads reach the browser without a public blob URL (L2-060 AC4), whether a role in a Shared audience follows later role changes, the wording of the Staff carve-out, and how the purge runs.

## Decision

### Storage is a sibling of photo storage

- `IFileStorage` (Application, `Resources/`) sits beside `IPhotoStorage`; it is not a widening of it. Photos are read through one-hour SAS URLs (ADR 0002), which would be a public URL for a resource and break L2-060 AC4. `IFileStorage` has `SaveAsync(key, stream, contentType)`, `OpenReadAsync(key)` and `DeleteAsync(key)` and no read URL.
- `AzureBlobFileStorage` (Infrastructure) uses the same `BlobServiceClient` and the private `resources` container. Keys are `resources/{resourceId}/{blobId}{.ext}` for the file and `resources/{resourceId}/{blobId}-thumb.png` for an image thumbnail; a replaced file gets a new blob id, so a cached download never serves the old file under the new name.
- Downloads and thumbnails stream through `GET /api/resources/{id}/file` and `GET /api/resources/{id}/thumbnail`, which apply the same visibility rule as every other read. The file is sent as `Content-Disposition: attachment` with the original file name and `X-Content-Type-Options: nosniff`, so an uploaded SVG or HTML-looking file never runs in the app's origin. The web app fetches both with its bearer token and hands the browser an object URL.
- A file is checked by extension against the allowed list, by size (100 MB) and by its leading bytes (`ResourceFileTypes`): PDF, OLE (PPT, DOC), ZIP containers (PPTX, DOCX, XLSX, KEY, ZIP), MP4 `ftyp`, PNG, JPEG, GIF, WebP, SVG markup and CSV text. A mismatch is refused with the same message as a wrong extension.
- Thumbnails are made for PNG, JPEG, GIF and WebP by `IImageProcessor.ThumbnailAsync` (the SkiaSharp processor of ADR 0001), fitted inside 480 px and re-encoded as PNG. SVG gets no thumbnail; it shows the Logo or Image type icon.

### Storage outages follow ADR 0013

- When the blob write fails, the resource is still saved with `IsStored = false` and a `ResourceBlobTask` (`Save`) holding the bytes commits in the same save. A failed delete (replace, purge) queues a `Delete` task. `ResourceStorageRetryHandler` retries with the photo backoff. A resource that is not yet stored is listed with its type icon, and its download answers 409 "This file is still uploading. Try again in a minute." until the write succeeds.

### A role in a Shared audience is live

- A Shared resource stores its named members (`ResourceShareMember`) and named roles (`ResourceShareRole`). Visibility is evaluated at request time against the caller's current roles, so a member who gains a role sees resources shared with it at once and a member who loses it does not (L2-060 AC8). Announcements snapshot their recipients because an announcement is a message delivered once; a shared resource is a standing permission, and a snapshot would leave a former Volunteer able to open the Volunteer kit and a new one unable to.
- Notifications are the only snapshot: recipients resolved at save time (named members plus current holders of named roles, de-duplicated, excluding the owner and suspended members) are notified; a later audience change notifies only the new recipients; a member who gains a role later is not notified (L2-061 AC3).

### The Staff carve-out

`AGENTS.md` and the domain rules read: "Staff is read-only across everything except private contacts and the resources Staff own: Staff may add resources and edit, share, archive and restore their own; every other Staff write is refused." `ResourceAccess.CanContribute` is the only place Staff gains a write, and it is granted alongside the four lead roles and System Admin. Staff still has no read-all access to Private or Shared resources (L2-060 AC6).

### Archive and purge

- Archiving sets `ArchivedAt`; archived resources leave every list, search and direct read except for their owner and System Admin (L2-063 AC2).
- `PurgeArchivedResourcesHandler` deletes resources archived 30 or more days ago: it deletes the file and thumbnail blobs (queueing a `Delete` task if storage is down) and the row with its tags and audience, and leaves the audit entries. It is idempotent. `ResourceMaintenanceWorker` runs it, with the storage retry, on the outbox interval and is switched off with `Outbox:Enabled`; the backend tests run the handler directly against a fake clock.

### Auditing

Every System Admin action on a resource they do not own (open or download of a Private or Shared resource, edit, replace, share, archive, restore) writes an audit entry, and every ownership transfer writes `resource.owner.transferred` with the old and new owner. The new owner is notified (`ResourceOwnershipTransferred`, in-app and email).

## Consequences

- Up to 100 MB of bytes can sit in a PostgreSQL row while storage is down; the row is deleted once the write succeeds.
- Downloads pass through the API rather than straight from blob storage. That costs API bandwidth, which is acceptable at community scale, and keeps every read behind one authorization rule.
- The web app uploads one file per request so each row can show its own progress; the API still accepts up to 20 files in one request and refuses more.
- Role audiences cost one join on the caller's roles in every list and search query; the caller's roles come from `ICurrentUser`, already loaded per request.
