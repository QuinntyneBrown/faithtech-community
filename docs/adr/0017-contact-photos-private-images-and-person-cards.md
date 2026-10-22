# 0017. Contact photos: private image URLs, creating with photos and the person card

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-055, L2-056, L2-057, L2-058, L2-059, L2-060, L2-061
- Design: `docs/detailed-designs/contacts/contact-photos`
- Refines: ADR 0002 (for contact photos), ADR 0013, ADR 0014

## Context

Leads can now add photos of their private contacts, and the contacts list becomes a grid of person cards. Private contacts are visible only to their owner and System Admin (ADR 0014). Profile photos are read through one-hour read-only SAS URLs (ADR 0002), which anyone holding the URL can use; that was accepted because every member can see profile photos anyway. The same rule would let a contact photo URL, once copied, show a private contact to anyone for an hour. Browsers do not send the app's bearer token with `<img>` requests.

The feature also had to settle how photos chosen on `/contacts/new` are saved, what a linked contact's card shows, what the decorative cover band shows, and how contacts reuse the profile photo pipeline without depending on profile handlers.

## Decision

**Private image URLs.** A contact photo's URL is the API path `/api/contacts/{id}/photos/{photoId}/image`. The endpoint requires authentication (`401` without a token), checks `ContactAccess` (`404` for anyone but the owner and System Admin, the same body as an unknown contact), audits a System Admin's fetch of another lead's photo as `contact.photo-viewed`, and streams the bytes from `IPhotoStorage.ReadAsync(key)` with `Cache-Control: private, max-age=300`. No SAS URL is ever issued for a contact photo. The web app fetches the image with `HttpClient` (so the bearer token is sent), turns it into an object URL in `ContactsService.photoImage`, and caches it per photo URL for the session. A photo that is still storing has no URL.

**Storage.** Contact photos use the same `IPhotoStorage` and private container as profile photos, under the key `contacts/{contactId}/{blobId}.{ext}`. Writes and deletes that fail are queued as `PhotoBlobTask`s and retried by `PhotoStorageRetryHandler`, exactly as ADR 0013 describes; the retry marks whichever photo (profile or contact) owns the task as stored. Permanently deleting a contact deletes its photo blobs after the rows are removed, queuing any delete that fails.

**Shared pipeline.** Contacts use the photo pipeline's Application abstractions and rules — `IImageProcessor`, `IPhotoStorage`, `PhotoDescription`, the 5 MB limit, `PhotoLeases` and `PhotoBlobTask` — and never call profile handlers. `PhotoLeases` now works on a `PhotoLease` (owned by `Profile` or `Contact`), and `PhotoBlobTask`'s factories take a photo id and blob key. The abstractions stay in `Application/Profiles/`.

**Creating with photos.** `POST /api/contacts` is unchanged. The form creates the contact, then uploads each chosen photo with `POST /api/contacts/{id}/photos`, the featured one first so the server features it. If an upload fails, the contact stays saved and the contact page opens with an alert naming the photos to add again.

**Linked contacts.** A linked contact's card and page header show the member's featured photo and name (`L2-015` AC2). The photos the lead added stay on the contact page, private to the lead and System Admin.

**Cover band.** The card's cover band is decorative: the tint of the person's avatar colour, chosen from the contact id as ADR 0008 chooses it from a profile id, or the neutral subtle background for the plain colour. Nobody uploads a cover.

## Consequences

- A contact photo can never be fetched by someone who is not signed in as its owner or a System Admin, even with its URL. This is stricter than ADR 0002 for profile photos.
- The API now carries contact image bytes (each at most a few megabytes after resizing). The grid fetches one image per card with a photo; the browser keeps them for five minutes and the app reuses its object URLs.
- Creating a contact with photos is several requests; a partial failure is reported rather than rolled back.
- Every System Admin fetch of another lead's contact image adds an audit entry.
- The person card has no connect or follow action, and its dismiss button always opens a confirmation.
