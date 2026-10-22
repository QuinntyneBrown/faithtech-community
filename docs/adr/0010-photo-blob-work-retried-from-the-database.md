# 0010. Photo blob work is retried from the database

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-007, L2-047
- Designs: `docs/detailed-designs/profiles/manage-profile-photos`, `docs/detailed-designs/platform/reliability-and-observability`
- Refines: ADR 0002

## Context

L2-047 AC3 requires photo actions to succeed while blob storage is down, with the storage work retried. Before this decision, `UploadPhotoHandler` awaited `IPhotoStorage.SaveAsync` before saving the photo, so a storage outage failed the upload. `DeletePhotoHandler` deleted the blob after saving, so an outage turned a committed delete into a 500 and left an orphan blob that nothing retried.

## Decision

- Uploads still validate, resize and strip metadata in the request (ADR 0001), so an invalid file still fails inline. The handler then tries the blob write once. When the write succeeds, nothing changes: the photo is stored and shown at once.
- When the write fails, the photo is still added to the profile with `ProfilePhoto.IsStored = false`, and a `PhotoBlobTask` (`Save`) holding the processed bytes, the blob key and the content type commits in the same `SaveChanges`. The photo counts towards the 10-photo limit and the featured rule from that moment. `PhotoDto` returns `isStored: false` and `url: null`.
- A failed blob delete queues a `PhotoBlobTask` (`Delete`) after the photo removal has been saved (ADR 0002's order is kept). Deleting a photo that is still storing removes its queued write, so its blob is never written.
- `PhotoStorageRetryHandler` (Application) runs from `PhotoStorageRetryWorker` (Infrastructure) on the outbox interval and is switched off with `Outbox:Enabled`. It retries due tasks with exponential backoff capped at one hour and no attempt limit: giving up would lose a photo the member was told was saved. A write that succeeds marks the photo stored, and a write whose photo has gone is dropped. Each task names one photo and one key, so a retry never creates a photo.
- Only ids, the work kind and the exception type are logged.

## Consequences

- Processed images (at most a few megabytes each) can sit in PostgreSQL while storage is down. The row is deleted once the write succeeds.
- A member sees a storing photo as a described placeholder with the status note "Saved. It shows on your profile once it finishes storing." (mock `pages/edit-profile/storing`). Their avatar keeps the initials until the image is stored.
- A blob delete that keeps failing is retried until it succeeds. An orphan is possible only if both the delete and the save of its task fail.
