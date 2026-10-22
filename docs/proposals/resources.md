# Proposal: Resources

A searchable home for the decks, logos, images, training materials and templates that FaithTech leads need, inside FaithTech Community.

- Status: agreed, awaiting requirements
- Date: 2026-10-22
- Next step: write `L1-020 Resources (RES)` and its L2 entries in `docs/specs/`, then mocks, detailed design and estimate, before any code.

## Problem

City Leads cannot find the materials they need. A city launch deck, the FaithTech logo pack, a hackathon judging rubric or a volunteer training slide set lives wherever its author last saved it: Google Drive, SharePoint, Canva, Dropbox, an email attachment or a laptop. New leads do not know what exists, experienced leads rebuild what already exists, and the one person who knows where a file lives becomes the bottleneck.

FaithTech Community already holds the people, events and announcements of the community and already has global search. It is the natural place for the materials too.

## What we are building

**Resources** is a new feature area. A resource is one item a member can find, open and download: an uploaded file, or a link to a file that must stay where it lives. Every resource has a title, a type, tags and a visibility, and is owned by the member who added it.

The feature is named `resources` everywhere the repository layout requires one name: `Domain/Resources/`, `Application/Resources/`, `frontend/projects/resources/`, `docs/specs/` (`L1-020`, `RES`), `docs/detailed-designs/resources/` and `docs/estimates/resources.md`. The navigation item and the search group are both called "Resources".

## Decisions

Each decision below was taken deliberately; the alternatives are recorded so they are not re-opened by accident.

### Storage: upload first, links allowed

A resource is either an **uploaded file**, stored in Azure Blob storage behind the existing storage abstraction (ADR 0002, ADR 0013), or an **https link** to a file elsewhere. Upload is the primary path, because the pain is that files are scattered: a catalogue of links would only add one more place to look. Links exist for things that must stay live in their own tool, such as a Canva template or a shared spreadsheet.

Rejected: upload only (forces migration of things that cannot move) and links only (search sees only what someone typed, links rot, privacy depends on the source app).

### Upload limits

Up to 100 MB per file. Allowed types: `pptx`, `ppt`, `key`, `pdf`, `docx`, `doc`, `xlsx`, `csv`, `png`, `jpg`, `svg`, `gif`, `webp`, `mp4`, `zip`. Anything else is refused with an inline error naming the allowed types. The limit covers a deck with embedded photos and a short video; larger media is a link.

### Links

A link must be `https`. It opens in a new tab. Lists show an external-link icon and the host (for example `drive.google.com`) so people know where they are going. There is no background reachability check in v1: many Drive and SharePoint links answer a sign-in page with a success status, so the signal would be weak. The owner is shown on every resource, so a dead link has someone to ask.

### Fields

| Field | Rule |
|---|---|
| Title | Required, up to 120 characters. For a batch upload it defaults to the file name without its extension. |
| Description | Optional, up to 1,000 characters, plain text. |
| Type | Required, one of **Deck, Logo, Image, Training, Template, Document, Other**. Guessed from the extension on upload, always editable. |
| Tags | Zero or more free-text tags, lower-cased and trimmed on save. The picker suggests tags already in use so spellings converge. No curated list and no admin screen. |
| Visibility | Required: Private, Shared or Global (below). |
| File or link | Exactly one of: an uploaded file (name, size, content type kept) or an https URL. |
| Owner, added, updated | Set by the server: the member who added it, when, and when it was last changed and by whom. |

### Visibility

| Level | Who can find, open and download |
|---|---|
| **Private** | The owner, and System Admin. |
| **Shared** | The owner plus the members and roles the owner chose. A share can name specific members (people picker) and whole roles (for example every City Lead), the same audience model the announcement composer already uses. Recipients cannot re-share. |
| **Global** | Every signed-in member. |

Nothing in Resources is visible to anonymous visitors; public events remain the only anonymous content.

A new resource defaults to **Global**, with the visibility picker always visible on the add dialog. The purpose of the feature is findability, and logos, decks and training are meant to be shared, so a private draft is a deliberate choice rather than the default. Rejected: private by default, which makes every upload need an extra step to become findable.

Rejected: a city tier. Data in FaithTech Community is global with no city boundary; private contacts are the only exception, and this proposal does not add a second one.

### Who can contribute

City Lead, Event Lead, Create Lead, Communications Lead, Staff and System Admin can add resources. Volunteers, Product Engineers and Attendees can find, open and download what is visible to them.

**Staff may add and own resources.** This is a deliberate carve-out from the rule that Staff is read-only across everything except private contacts. The rule in `AGENTS.md` gains this second exception when the requirements land; everything else stays read-only for Staff.

### Editing and ownership

- Only the **owner** can change a resource's details, tags, visibility or file, or archive it.
- **System Admin** can override any of that; every override is written to the audit log, as everywhere else.
- Replacing a file **swaps it in place**. The resource records when it was updated and by whom. There is no version history in v1; it can be added later without changing the model.
- When an owner is suspended or loses their lead role, their resources **stay** exactly as they are. A System Admin can **transfer ownership** from the resource page, audited. Rejected: archiving private and shared resources on suspension, which would surprise the people they were shared with.

### Adding several at once

The add dialog accepts up to **20 files** in one go. Each file becomes its own resource: the title comes from the file name, the type from the extension, and the tags and visibility chosen once apply to the whole batch. Details can be edited afterwards. Links are added one at a time.

### Finding

- The **Resources page** opens on *Recently added*, newest first, and filters by type and by tag. Its search box matches title, description, tags and file name.
- **Global search** gains a *Resources* group, built as one more `ISearchSource` on the existing Postgres full-text search (ADR 0016). Visibility is applied inside the query, never in the UI.
- **No text extraction** from inside PDF, PPTX or DOCX files in v1. Finding "the deck that mentions Kestrel Labs" would need a background extraction job and parsing libraries; it is a candidate later slice, not part of this proposal.

### Previews

Uploaded images get a thumbnail through the existing SkiaSharp image processor (ADR 0001). Decks, PDFs, documents, videos and links show a type icon with the file name, size and type. There is no server-side rendering of slide or PDF pages; that would need a converter in the container.

### Notifications

Sharing a resource raises a **ResourceShared** notification to each recipient: "*Owner* shared *title* with you", linking to the resource, delivered in-app and by email through the existing notification publisher, inside the same save as the share.

Adding a Global resource notifies nobody and does not appear on Home; the Resources page's *Recently added* list is the discovery path. Rejected: a Home card and a notification per Global resource (a batch of ten logos would be ten notifications).

### Deleting

Deleting a resource **archives** it: it disappears for everyone except the owner's *Archived* view and System Admin, and the owner can restore it. A background job **purges** the blob and the row **30 days** after archiving. This mirrors how private contacts are archived and restored.

### Not in v1

- Usage counts (opens, downloads).
- Version history.
- Text extraction and content search inside files.
- Page thumbnails for decks and PDFs.
- Link reachability checks.
- Collections or folders; types and tags are the only organisation.
- Any anonymous access.

## Delivery

The build follows the repository's incremental, acceptance-test-driven rule: requirements, detailed design and mocks first, then one slice at a time with its Given-When-Then criteria and tests written before the code.

| Slice | Delivers |
|---|---|
| 1 | Resources page: list newest first, filter by type and tag, open and download uploaded files. Add (single and batch upload) and edit with Private or Global visibility. Image thumbnails. |
| 2 | Link resources. |
| 3 | Shared visibility with members and roles, and the ResourceShared notification. |
| 4 | Resources group in global search. |
| 5 | Archive, restore and the 30-day purge job. |
| 6 | System Admin ownership transfer, with audit. |

Each slice ships end to end: domain and persistence (one EF migration applied by the Cli), Application handlers with server-side permission checks and tests for who must **not** see a resource, API endpoints, the `api` client contract and token, components in `components` where the design system needs them, the feature pages, the e2e fake and Playwright specs with axe, and the estimate.

## Reuse

- Storage: the photo storage abstraction and its retry worker (ADR 0002, 0013) generalise to files; the design will decide whether to widen `IPhotoStorage` or add a sibling file storage contract behind the same blob client.
- Audience picker, notification publisher and outbox: as built for announcements and shared with events (ADR 0016).
- Search: one new `ISearchSource` with a permission-filtered base query.
- Archive and restore: the contacts pattern.
- Audit: `IAuditLog` for every System Admin override and ownership transfer.

## Open questions for the requirements step

None blocking. Two details are left to the requirements and design, within the decisions above:

1. The exact wording of the Staff carve-out in `AGENTS.md` and the domain rules.
2. Whether a resource shared with a role should follow role changes live (a new Event Lead sees it at once) or snapshot the recipients at share time. The announcement model snapshots; the design should pick and record the choice in an ADR.
