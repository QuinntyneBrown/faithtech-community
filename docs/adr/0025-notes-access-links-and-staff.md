# 0025. Notes: access, links and the Staff rule

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-022, L2-085, L2-090, L2-091, L2-092, L2-093, L2-095, L2-098
- Designs: `docs/detailed-designs/notes/share-and-visibility`, `docs/detailed-designs/notes/links-and-backlinks`, `docs/detailed-designs/notes/archive-and-search`, `docs/detailed-designs/notes/pages-and-list`
- Refines: ADR 0017

## Context

Docs & notes pages hold drafts and team knowledge. `docs/proposals/notes.md` fixes the visibility model (Private, Shared, Global, as Resources), owner-only edits with an audited System Admin override, and that every verified member may create pages. Pages also refer to each other through links, backlinks, a parent and a breadcrumb, each of which could reveal a page the viewer may not open. `AGENTS.md` says Staff is read-only except for named carve-outs, and the carve-out for Resources (ADR 0017) did not cover pages.

## Decision

### Visibility follows ADR 0017, with Private as the default

- `NoteAccess.Visible` is the one predicate for every read: active pages that are Global, owned by the caller, or Shared with the caller by name or by a role they hold now; System Admin sees every active page. Archived pages are openable only by their owner and System Admin.
- Role audiences are live, as for resources; notifications are the only snapshot.
- New pages are **Private**, unlike resources (Global by default): a page usually starts as a draft, and widening it is a deliberate act that notifies people.
- A page the caller may not open answers `404`, whether it is missing, archived or hidden.

### Every verified member may create; only the owner changes

- Any signed-in member with a verified email may create pages; no role is needed. Create, share and image upload refuse an unverified caller with `403`.
- Only the owner edits, shares, moves, archives and restores a page. Readers of Shared and Global pages get a read-only view and cannot re-share.
- **City Leads and every other lead have no special rights** over other members' pages. Pages are personal work, not city data.
- **System Admin** may do anything to any page. Every action on a page they do not own, and every opening of a Private or Shared page they do not own, writes an audit entry: `note.opened`, `note.edited` (one per save, holding versions and title, not content), `note.shared`, `note.moved`, `note.archived`, `note.restored`.

### The Staff carve-out is extended

`AGENTS.md` now reads: "Staff is read-only across everything except private contacts and the resources and note pages Staff own: Staff may add resources and note pages and edit, share, archive and restore their own; every other Staff write is refused." Staff create pages and change only their own, exactly as any member; Staff gain no read-all access to Private or Shared pages.

### Page-link titles are resolved at read time

- Page-link spans store only the target id. On every read the server fills the target's current title when the viewer may open it, and "Private page" (not linked) otherwise. A renamed page shows its new title everywhere with no rewrite, and a title never reaches a viewer who may not open the page.
- A missing, archived or hidden target all read "Private page", so a link reveals nothing about existence.

### Backlinks, children and breadcrumbs show only visible pages

- "Linked from" and "Pages inside" list only pages the viewer may open; hidden ones are neither named nor counted.
- A breadcrumb ancestor the viewer cannot open reads "Private page" and is not linked.

### A parent belongs to the same owner

- A page's parent shall be owned by the page's owner, be active, and be neither the page nor one of its descendants. Otherwise the move or create answers `400` "Choose another page.", the same answer for a parent the caller cannot see.
- Keeping a subtree under one owner means the only person who can rearrange it is the person who owns all of it, and a member can never attach a page under someone else's page.

### Archive is a soft delete without purge

- Archiving sets `ArchivedAt` and changes nothing else: children keep their parent, links stay, images stay. Restoring clears it. Archived pages are not purged in v1.

## Consequences

- One predicate guards lists, pages, search, suggestions, parent options, backlinks, breadcrumbs, children and images; each reader runs it inside SQL.
- Resolving link titles per read costs one query per page view for the targets' titles; at community scale this is cheap and avoids rewriting other pages on rename.
- A System Admin editing someone's page through autosave writes one audit entry per save; the audit log may hold several entries for one editing session.
- A shared subtree is not inherited: sharing a parent does not share its children. Each page has its own visibility, and the breadcrumb shows "Private page" for ancestors the reader cannot open.

## Deferred

Editing by anyone but the owner, inherited visibility for child pages, transferring page ownership, public (anonymous) sharing, and purging archived pages.
