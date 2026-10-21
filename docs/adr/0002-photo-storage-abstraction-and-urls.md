# 0002. Photo storage abstraction, blob key layout and read URLs

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-005, L2-007
- Designs: `docs/detailed-designs/profiles/view-profile`, `docs/detailed-designs/profiles/manage-profile-photos`

## Context

Photos are stored in Azure Blob Storage. The view-profile design left the access form (public container, SAS URL or API proxy) `<TO SUPPLY>`. Profiles, and so their photos, are for signed-in members only. Browsers load `<img>` sources without the app's bearer token, so an authenticated API proxy would need every image fetched by script. Backend tests must fake blob storage.

## Decision

- `IPhotoStorage` (Application) has three operations: `SaveAsync(key, stream, contentType)`, `DeleteAsync(key)` and `GetReadUrl(key)`. `AzureBlobPhotoStorage` in `Infrastructure/Storage/` implements it over the registered `BlobServiceClient`; the API tests replace it with an in-memory fake.
- Container: `profile-photos` (private, created on first use). Key: `profiles/{profileId}/{blobId}.{jpg|png|webp}`, where `blobId` is a fresh GUID per upload, so a key is never reused. `ProfilePhoto.BlobName` stores the key.
- Photo URLs in `ProfileDto` are **read-only SAS URLs that expire after one hour**, generated per response. They are only ever handed to signed-in members by the authenticated profile API.

## Consequences

- No public container and no image proxy; images load directly from storage.
- A SAS URL can be shared for up to an hour; this is accepted for profile photos, which every member can see anyway.
- SAS generation needs an account key (connection string) or a user-delegation key in production; the connection string is configuration (`ConnectionStrings:Blobs`), never committed.
- Deleting a photo deletes its blob after the database change is saved; a failed blob delete leaves an orphan blob but never a broken profile.
