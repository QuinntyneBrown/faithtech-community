# Proposal: Docs & notes

Block-based pages where FaithTech members write, format, link and nest meeting notes, playbooks and how-tos, inside FaithTech Community.

- Status: implemented; requirements `L1-022` and `L2-085` to `L2-099` in `docs/specs/`, designs in `docs/detailed-designs/notes/`, built in `notes` (backend, frontend and e2e)
- Date: 2026-10-22
- Run: `docs/prompts/notes-prompt.md` carries the brief; this proposal carries the decisions every artifact (mocks, design system, specs, designs, ADRs 0023 to 0025, estimate, code) follows.

## Problem

Leads keep meeting notes, playbooks and how-tos in Google Drive, SharePoint and email. A new City Lead cannot find the Builders Night run sheet, the volunteer onboarding checklist is three versions deep in someone's inbox, and notes from a partner meeting live on one laptop. Resources (L1-020) holds finished files; nothing holds the living, written knowledge of a city team.

## What we are building

**Docs & notes** is a new feature area, named `notes` everywhere the layout requires one name: `Domain/Notes/`, `Application/Notes/`, `frontend/projects/notes/`, `docs/specs/` (`L1-022`, `NOTES`), `docs/detailed-designs/notes/`, `docs/estimates/notes.md`. The navigation item and the search group are both called **Notes**. One item is a **page**.

A page has a title, an optional emoji icon, an optional parent page, a visibility and an ordered list of **blocks**. Pages are never visible to anonymous visitors.

## Decisions

### Who may do what

| Who | May |
|---|---|
| Every signed-in member with a verified email | Create pages; edit, share, move, archive and restore the pages they own. |
| Anyone a page is visible to | Read it (read-only view), follow its links, see its backlinks. |
| Staff | Exactly the same as every member: create pages and change only their own. This extends the Resources carve-out (ADR 0017): "Staff may add resources and note pages and edit, share, archive and restore their own; every other Staff write is refused." |
| City Lead (and every other lead) | Same as every member. No lead can change another member's page. |
| System Admin | Open, edit, share, move, archive and restore any page. Every action on a page they do not own, and every opening of a Private or Shared page they do not own, writes an audit entry. |

Only the owner edits. Shared and Global readers get a read-only view. Co-editing is deferred.

### Visibility

Same model as Resources (L2-060, L2-061, ADR 0017): **Private** (owner and System Admin), **Shared** (named members and/or roles; a role audience is live), **Global** (every signed-in member). **New pages default to Private.** Sharing notifies each new recipient in-app and by email (`NotePageShared`, "{Owner} shared {title} with you", linking to `/notes/{id}`); this email cannot be turned off. Recipients cannot re-share. Visibility is applied inside every query: lists, page reads, images, search, backlinks, breadcrumbs, children, page-link text and page-link suggestions. A page the caller may not open answers 404.

### Blocks

Thirteen types (wire names in brackets): Text (`paragraph`), Heading 1-3 (`heading1`, `heading2`, `heading3`), Bulleted list (`bulleted`), Numbered list (`numbered`), To-do (`todo`, with `checked`), Quote (`quote`), Callout (`callout`, with an emoji `icon`, default 💡), Code (`code`, plain text, monospace, no highlighting), Divider (`divider`), Image (`image`, an uploaded image with required alt text), Link card (`link`, an https `url` and an optional `caption`).

Text-bearing blocks hold **rich-text spans**: `{ text, bold?, italic?, underline?, strike?, code?, href?, pageId? }`. `href` is an `https://` or `mailto:` link. `pageId` makes the span a **page link**; the server stores page links without their text and fills the text at read time with the target's current title, or **"Private page"** when the viewer cannot open the target, so a title never leaks.

Limits: title 200 characters (empty shows as "Untitled"), 500 blocks a page, 10,000 characters of text a block, link URLs 2,000 characters, alt text 250 characters, caption 200 characters.

### Storage, ordering and saving (ADR 0023)

- Blocks are stored as one JSON document (`Content`) on the page row; there is no block table. A `NoteLinks` table (`SourceId`, `TargetId`) is rebuilt from the page links on every save and drives backlinks. A plain-text `BodyText` column (block text without page-link titles, plus link-card captions), derived on save, feeds search and the list's search box. Images have their own `NoteImages` table.
- **Whole-page saves**: `PUT /api/notes/{id}` sends the title, icon and the full ordered block list. Order is array order, so no fractional index is needed; per-block operations and fractional indexing only pay off with real-time co-editing, which is deferred.
- **Concurrency**: the page carries an integer `Version`. Every save sends the version it was based on. A mismatch answers **409** with the current version, who saved it (and whether it was the caller) and when; nothing is overwritten. Sharing, moving, archiving and image uploads do not change the version. The client stops autosaving and shows the conflict banner with "Reload page".
- **Autosave**: the editor saves 800 ms after the last change, one save in flight at a time. The status shows nothing until a save is sent, then reads "Saving…", "Saved" or "Couldn’t save" with "Retry".

### Editor (ADR 0024)

- Own editor, built in `components` (no third-party editor): each text block is a stable `contenteditable` text box built without `innerHTML`; Angular CDK drag-drop reorders blocks by a handle with a drop indicator; the block menu uses CDK Menu and every form a CDK Dialog; the slash menu, page-link suggestions and formatting toolbar are positioned inside the editor.
- The editing surface is a **content editor, not a form**; the "no inline forms in pages" rule applies to forms. Every form the feature needs (share, page settings, change icon, move, archive, restore, add image, edit alt text, add link, add link card) is a CDK dialog.
- Keyboard and screen-reader alternative to dragging (WCAG 2.5.7): every block's handle opens the **block menu** (Turn into, Change icon for a callout, Edit alt text for an image, Move up, Move down, Duplicate, Delete); **Alt+Shift+↑ / ↓** moves the focused block; a polite live region announces "Moved {block} to position {n} of {total}", {block} being the type and up to four first words.
- Markdown shortcuts at the start of a block: `# `, `## `, `### `, `- ` (or `* `), `1. `, `[] `, `> `, ` ``` `, `---`. Typing `/` opens the **slash menu** (filterable, arrow keys, Enter, Escape) to insert a block or turn the current one into another type. Typing `[[` opens **page-link suggestions** (up to 10 visible pages by title, most recently edited first).
- Formatting: a **formatting toolbar** appears over a text selection: Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strikethrough (Ctrl+Shift+S), Inline code (Ctrl+E), Link (Ctrl+K, opens the "Add a link" dialog), and Remove link inside a link.

### Links, backlinks and nesting

- A page lists **Linked from**: the pages that link to it **and that the viewer may open**; hidden ones are not counted or named.
- A page may have one **parent** that the same owner owns; moving is done with the "Move" dialog (not under itself or its descendants). The page shows a **breadcrumb** "Notes › {ancestors} › {title}" (an ancestor the viewer cannot open reads "Private page", not linked) and a **Pages inside** list of the child pages the viewer may open.
- Archiving a page does not touch its child pages.

### Images (photos rule)

An image block is created through the **Add an image** dialog: JPEG, PNG or WebP up to 5 MB, alt text required ("Describe this image", same rule as profile photos, L2-007 AC3). The file is checked, resized and stripped of metadata by the photo processor (`IImageProcessor`, ADR 0001) and stored behind `IFileStorage` (ADR 0017) at `notes/{pageId}/{imageId}.{ext}` and streamed through `GET /api/notes/{id}/images/{imageId}` under the page's visibility. The server refuses a save holding an image block with empty alt text, or an image not uploaded to that page (400). A storage failure answers 503 with no retry queue. There is no cap on images per page in v1. Orphaned image clean-up is deferred.

### Archive and restore

Archive is a soft delete by the owner or System Admin. An archived page leaves every list, search, backlink, suggestion and direct read except for its owner and System Admin; links and breadcrumbs to it read "Private page". Archiving an archived page, or restoring an active one, answers 409. `/notes/archived` lists the caller's archived pages with **Restore**; *Undo* on the archive toast restores the page and reopens it. No purge in v1.

### Finding

The Notes page lists the visible pages, **recently edited first**, 25 at a time, with a search box over titles and page text and an owner filter (All pages, Mine, Shared with me). Global search gets a **Notes** group (`ISearchSource`, title and body text, visibility in the base query, at most 10).

## API

| Method and path | Purpose |
|---|---|
| `GET /api/notes?q=&owner=all|mine|shared&page=` | The list (`PagedResult<NotePageSummary>`) |
| `POST /api/notes` `{ title?, parentId? }` | Create (201, Private) |
| `GET /api/notes/{id}` | The page: blocks, version, breadcrumb, children, backlinks, audience, `canEdit` |
| `PUT /api/notes/{id}` `{ title, icon, blocks, version }` | Whole-page save (200 with the new version, 409 on conflict) |
| `PUT /api/notes/{id}/visibility` `{ visibility, memberIds, roles }` | Share or change visibility |
| `PUT /api/notes/{id}/parent` `{ parentId }` | Move |
| `POST /api/notes/{id}/archive`, `POST /api/notes/{id}/restore` | Archive, restore (204; 409 when already in that state) |
| `GET /api/notes/archived` | The caller's archived pages |
| `GET /api/notes/links?q=&exclude=` | Page-link suggestions (up to 10 visible pages) |
| `GET /api/notes/{id}/parent-options?q=` | The move dialog's choices (the owner's active pages outside the subtree) |
| `GET /api/notes/members?q=` | The share picker |
| `POST /api/notes/{id}/images` (multipart `file`) | Upload an image for an image block (201 `{ imageId }`, 503 when storage fails) |
| `GET /api/notes/{id}/images/{imageId}` | Stream an image |

Audit actions: `note.opened`, `note.edited`, `note.shared`, `note.moved`, `note.archived`, `note.restored`.

## Screens

- `/notes` (Notes list), `/notes/archived` (Archived pages), `/notes/{id}` (page editor or read-only view).
- Dialogs: share-note, note-settings (title and icon), change-icon, move-note, archive-note, restore-note, add-image, edit-alt-text, add-link, add-link-card.
- The nav item **Notes** opens for every signed-in member, placed after Resources.

## Requirements map

| ID | Title |
|---|---|
| L1-022 | Docs & notes (NOTES) |
| L2-085 | Notes list: create and find pages |
| L2-086 | Page editor: title, icon, blocks and autosave |
| L2-087 | Block types |
| L2-088 | Inline formatting, markdown shortcuts and the slash menu |
| L2-089 | Reorder blocks by drag and by keyboard |
| L2-090 | Page links and backlinks |
| L2-091 | Nested pages, move and breadcrumb |
| L2-092 | Page visibility and access on the server |
| L2-093 | Share pages with members and roles |
| L2-094 | Edit conflicts |
| L2-095 | Archive and restore pages |
| L2-096 | Notes in global search |
| L2-097 | Image blocks and alt text |
| L2-098 | Staff and System Admin on pages |
| L2-099 | Notes accessibility |

ADRs: 0023 notes block storage, ordering and concurrency; 0024 notes editor on contenteditable with Angular CDK; 0025 notes access, links and the Staff rule.

## Deferred

Real-time co-editing and presence, comments and mentions, version history, templates, import/export, databases and tables, embeds, public sharing, offline editing, purging archived pages, cleaning up orphaned images, editing by anyone but the owner.
