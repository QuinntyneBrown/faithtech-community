# Proposal: Event hubs

A chapter lead builds a participant hub for an event, like the SoCal Hackathon hub, by answering a few short wizards. The system generates the page from that data.

- Status: draft, for discussion
- Date: 2026-11-01
- Next step: agree the decisions below, then write the requirements (an L2 group under the Events L1 in `docs/specs/`), mocks of every wizard step and the generated page, and a detailed design under `docs/detailed-designs/events/`, before any code.

## Problem

The participant hub for the FaithTech SoCal × Baptize The World Hackathon (`docs/events/socal-hackathon-2026/index.html`) worked well on the day. It held the agenda with a live "happening now" highlight, the venue, parking maps, the partner, the tracks, the Create Cycle, the build rules, submission and feedback links, the demo format, judging and honors, mentors and judges, the worship set, the slides, giving and upcoming events.

It was also 161 KB of hand-written HTML. Only someone who can write a web page could build it, it took days, it could not be reused for the next event, and changing a time on the morning meant editing code. Every chapter wants the same kind of page for its own events, and most chapter leads are not developers.

FaithTech Community already knows most of what the page says: the event, its date, venue and RSVP link; the partners; the people; the chapter's other events; the organisation's name, logo and giving link. The lead should only have to type what the system does not already know.

## What we are building

An **event hub** is an optional, generated page attached to an existing event. The lead fills in a hub through short wizards; the app renders the page from that data. Nothing is hand-coded and nothing is uploaded as HTML.

- It extends the existing `events` feature (`Domain/Events/`, `Application/Events/`, `frontend/projects/events/`, `e2e/tests/events/`). It is not a new subsystem.
- A hub is made of **sections**. Each section has a kind, an order, a visible flag and structured content. Every section is optional.
- The hub lives at the event's public page on the organisation's host. Anonymous visitors see it only when the event is public, the same rule as today's public event page. A hub on a members-only event is visible to signed-in members only.
- Each organisation keeps its own hubs, templates and theme. Nothing crosses organisations.

## How it feels to a chapter lead

The whole experience is three things: one short wizard to start, a checklist to finish, and quick edits on the day.

### 1. Start a hub (one wizard, four steps, about two minutes)

From an event's page the lead selects **Create event hub**. A dialog-sized wizard opens with a progress indicator ("Step 1 of 4"), Back, Next and **Save and finish later** on every step. Drafts save automatically.

| Step | Question on screen | What the lead does | Defaults |
|---|---|---|---|
| 1. Event | "Which event is this hub for?" | Confirms the event (already chosen when started from the event page) | Title, date, time, venue, time zone and RSVP link come from the event; nothing to retype |
| 2. Starting point | "How do you want to start?" | Picks one card: **Hackathon**, **Meetup**, **Workshop**, **Blank**, or **Copy a past hub** | Templates fill sensible text: the Create Cycle, standard build rules, a default judging rubric. Copy brings over every section from a chosen past hub with dates shifted |
| 3. Sections | "What should the hub include?" | Ticks or unticks sections in a single checklist, each with one line explaining it | Pre-ticked by the template |
| 4. Done | "Your hub is ready to fill in" | Chooses **Fill in sections now** or **Preview** | The hub stays a draft until published |

### 2. Finish it from the checklist (the hub home)

The hub home is deliberately small. It shows only:

- the status (Draft or Published) and the hub's link,
- a progress line, for example "7 of 11 sections ready",
- one row per section with its state: **Ready**, **Needs info** or **Hidden**, and a **Fill in** or **Edit** button,
- **Preview**, **Publish** (or **Unpublish**) and **Share** (copy link and QR code).

There is no page builder, no layout grid and no styling panel. Selecting a section opens that section's own short wizard (one to three steps). The lead can do one section today and another next week; the checklist remembers.

Sections that the system can fill alone (Hero, Upcoming events, Giving) show as **Ready** from the start, with an **Edit** button for anyone who wants to change them.

### 3. Day-of quick edits (phone first)

On the day the lead opens the hub on a phone and sees **Quick edits**:

- **Post an update**: one text field; shows as a banner at the top of the hub ("Lunch moved to 12:15"). Clears with one tap.
- **Move a session**: pick an agenda row, change its time. Later rows offer to shift by the same amount.
- **Swap a link**: change the submission or feedback form link.

Each quick edit is one screen and goes live immediately.

## Section catalogue

Every section of the SoCal hub maps to a section kind. The table shows where the data comes from and what the lead types in that section's wizard.

| Section | Filled from the system | Lead enters (wizard steps) |
|---|---|---|
| **Hero** | Event title, date, venue, RSVP link, organisation logo, partner logos | Optional subtitle and a cover image (1 step) |
| **Agenda** (live "now" highlight in the event's time zone) | Event start and end | Rows of time, title and optional detail. Add one at a time, or paste a plain-text schedule ("9:00 Doors open") and confirm the parsed rows. Reorder by drag or keyboard (2 steps: rows, review) |
| **Venue** | Venue name and address, map link | Optional directions note and photo (1 step) |
| **Parking** | — | Map images (from Resources or upload) and short notes per option (1–2 steps) |
| **What to bring / On the day** | Template checklist | Edit the checklist items (1 step) |
| **Partners** | Partners linked to the event: name, logo, description | Pick partners, optional "Meet our partner" paragraph (1 step) |
| **Tracks** | — | Per track: title, one-paragraph brief, optional link (challenge repo, test data); mark one as primary. "What good looks like" note (2 steps) |
| **Process** (e.g. the Create Cycle) | Template text for the organisation's process | Edit stages or keep the default (1 step) |
| **Rules** | Template rules | Edit the list (1 step) |
| **Submission and feedback** | — | Submission link, feedback link, code-freeze time (picked from the agenda) (1 step) |
| **Demo format** | Template | Total minutes, segments and Q&A time (1 step) |
| **Judging and honors** | Template rubric | Criteria with weights (must total 100%; shown live), score scale, honors with how each is chosen (2 steps) |
| **People** (mentors, judges, speakers) | Member profiles: name, photo, role | Search members or add a guest (name, photo, one line), tag as mentor, judge or speaker (1–2 steps) |
| **Worship** | — | Song titles with optional links (1 step) |
| **Slides** | Resources already attached to the event | Upload a PDF or images, or pick a resource. Thumbnails and the viewer are generated (1 step) |
| **Giving** | Organisation's giving link and text | Optional event-specific line (1 step) |
| **Upcoming events** | The chapter's next public events, automatically | Nothing; choose how many to show (optional) |

A **Custom text** section (heading plus formatted text) is an open question, below.

## Design rules that keep it easy

These are requirements, not aspirations; mocks and reviews check them.

1. **One question per step.** At most about five fields on any wizard step.
2. **Defaults everywhere.** Templates, the event and the organisation fill everything they can. A lead who accepts every default gets a publishable hub.
3. **Nothing is required except the event.** Any section can be hidden. An empty section is never published; the checklist shows it as Needs info.
4. **Never retype what the system knows.** Changing the event's time or venue updates the hub.
5. **Preview is always one tap away**, on every wizard step and on the hub home, showing the real generated page.
6. **Plain language.** Labels say what the visitor will see ("Shown under 'Where'"), not field names.
7. **Validate on the step.** Errors appear next to the field on the step that caused them, never at publish time.
8. **Save as you go.** Leaving a wizard keeps what was entered.
9. **Mobile works.** Every wizard and quick edit works at phone width.
10. **House rules.** Wizards and dialogs use Angular CDK Dialog; every control comes from the `components` library (a stepper, a section checklist row and a progress line are added there first if missing); WCAG 2.2 AA throughout; no inline forms on pages.

## Decisions

### The page is rendered live from data, not stored as HTML

The public hub is an Angular route in the `events` library that renders the sections from the hub's data through the API. Edits are live immediately, the page uses the organisation's design tokens and stays accessible, and visibility is enforced by the server on every read.

Rejected: generating and storing a static HTML file per publish (stale after every edit, a second rendering path to keep accessible, harder to enforce visibility).

### Download as an archive, for the record

A **Download archive** action on the hub home produces a self-contained folder (`index.html` plus images and slides), the same shape as `docs/events/socal-hackathon-2026/`, so a chapter can keep a copy after the event.

### Structured sections, not a free page builder

Each section kind has a fixed shape and a fixed layout. This is what makes the wizards short and the pages consistent and accessible.

Rejected: a drag-anything page builder (overwhelming, inconsistent, hard to keep WCAG AA) and a rich-text "write your page" field (no live agenda, no reuse, no data from the system).

### Templates are organisation data, not code

Hackathon, Meetup and Workshop templates, with their default text (FaithTech's Create Cycle, build rules, judging rubric), are seed data for the FaithTech organisation, like the roles in `L2-151`. Organisation administrators can edit them in Organisation settings. Code never names them.

### Reuse existing features for content

People come from Profiles, partners from Partners, images and slides from Resources, upcoming events from Events filtered by the event's chapter. A guest (a judge without an account) is entered on the hub only and is never turned into a profile.

### Permissions are a capability

A new capability, `ManageEventHubs`, allows creating, editing, publishing and unpublishing hubs. The FaithTech seed grants it to City Lead and Event Lead. Handlers check the capability, never a role name. `AdministerOrganisation` may override; every override, publish and unpublish goes to the audit log. A caller without the capability gets 403.

## Data model sketch

- `EventHub`: Id, OrganisationId, EventId (one hub per event), Status (Draft, Published), TemplateKey, UpdateBanner, PublishedAt, timestamps.
- `HubSection`: Id, EventHubId, Kind, Order, Visible, Content (JSON validated against the section kind's schema in Application).
- `HubTemplate`: Id, OrganisationId, Name, Sections with default content. Seeded per organisation.

All three are organisation-scoped through the DbContext's global query filter. Migrations live in `Infrastructure/Persistence/Migrations/` and are applied by the Cli.

## Scope and phases

**Phase 1: a useful hub.** Create-hub wizard (Blank only), hub home checklist, preview, publish and share. Sections: Hero, Agenda with live highlight, Venue, People, Submission and feedback links, Giving, Upcoming events.

**Phase 2: hackathon-ready.** Templates and Copy a past hub. Sections: Parking, What to bring, Partners, Tracks, Process, Rules, Demo format, Judging and honors, Worship, Slides.

**Phase 3: the day and after.** Quick edits (update banner, move a session, swap a link), QR share, Download archive.

**Out of scope (v2, per AGENTS.md):** hackathon team registration, project submissions inside the app and judging scores. The hub links to external forms for these until then.

## Open questions

1. Can a lead whose role is tagged with a chapter edit hubs for other chapters' events? Chapters filter and never hide, so the default answer is yes. **Answered (slice 41, ADR 0036): yes.** A chapter-tagged holder of `ManageEventHubs` manages hubs for every chapter's events and organisation-wide events (`L2-155` AC3).
2. Do we allow a **Custom text** section for anything the catalogue does not cover?
3. Should templates be editable by chapter leads, or only by organisation administrators?
4. Multi-language hubs: needed in v1?
5. Should publishing a hub notify the event's RSVPs (in-app and email, using Notifications)?
