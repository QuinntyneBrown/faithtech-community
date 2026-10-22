# FaithTech Community mocks

Static HTML mocks for every page, dialog and notification, built from [`idea.txt`](../../idea.txt) and [`decisions.txt`](../../decisions.txt), styled with the [FaithTech Community design system](../design-system/README.md) (tokens and components inherited from Shelfie).

## How to open

- Open [`index.html`](index.html) from disk in Chrome. It is the gallery of every screen and state.
- `?theme=dark` / `?theme=light` forces a theme; `t` toggles it. `?chrome=0` hides the mock bar and notes.
- Each mock's bottom bar links its sibling states.
- A button that opens another mock (Remove photo opens Delete photo, say) stays a `<button type="button">` and names its target in `data-href`; `mock.js` follows it. Never turn a button into a link to make it navigate.

## Assets

| File | Source |
|---|---|
| `../design-system/tokens/tokens.css` | Design system tokens (single source of truth) |
| `../design-system/assets/components.css` | Design system components, including the FaithTech additions formerly in `assets/ui-extra.css` |
| `assets/mock.css`, `mock.js` | Mock chrome from Shelfie |

## Cast and catalog

"Today" is **Tuesday 21 October 2026**.

| Person | Roles | City | Avatar | Used as |
|---|---|---|---|---|
| Grace Okonkwo | City Lead | Toronto | sky | Default signed-in user |
| Marcus Lee | Event Lead | Toronto | sun | Lead on Grace's team workspace |
| Hannah Kim | Communications Lead | Toronto | lilac | Sends announcements |
| Samuel Mensah | Create Lead, Product Engineer | Toronto | mint | Profile being viewed |
| Ruth Alvarez | Volunteer | Toronto | rose | Team member; can't open the workspace |
| Jonah Bell | Product Engineer, Attendee | Toronto | sage | Member view of events and search |
| Leah Thompson | — | Toronto | peach | New member with no role |
| Daniel Reyes | Staff | Austin | sage | Read-only oversight |
| Priya Shah | System Admin | Vancouver | lilac | Admin and audit log |
| Esther Nakamura | City Lead | Austin | mint | Cancelled the Austin panel |
| Tomás Ortega | — (private contact) | Toronto | sun | Grace's contact who just signed up |

- **Avatar colours** come from each member's profile id (ADR 0008), so a person keeps one colour on every screen. Seven colours serve every member, so colours repeat (Marcus and Tomás are both sun); the printed name, never the colour, identifies a person. Private contacts who have not signed up, and suspended accounts, use the plain avatar.
- **Events:** Toronto Builders Night (public, Thu 6 Nov), City Team Prayer & Planning (members only, Tue 28 Oct), Hackathon: Tech for Shelters (public, 14–15 Nov), Austin Faith & AI Panel (cancelled).
- **Partners:**
  - Lead: Maple Street Church, Northgate Credit Union, Ellis Design Studio, St. Brigid's Parish
  - In funnel: Lantern Foundation, Kestrel Labs, Harbour Coffee Co.
  - Confirmed: Trinity Community Centre and 4 more
- **Workspaces:** "Toronto team" (Scrum, owner Grace; members Marcus, Hannah, Samuel and Ruth), "Hackathon ops" (Kanban, owner Grace) and "Austin city team" (owner Esther, who has lost the City Lead role; System Admin reassigns it). Jonah isn't a member of any workspace.
- **Work items:** the initiative "Launch the hackathon season" contains the epic "Tech for Shelters hackathon", with its stories and tasks. Sprint 7 runs Mon 20 – Fri 31 Oct.

## Requirement tags

`mock:requirements` lists the L2 IDs from [`docs/specs/L2.md`](../specs/L2.md) that each screen implements.

## Open questions and assumptions

1. Agile work management follows the **AGILE WORK MANAGEMENT** section of `decisions.txt`. There are no open questions left; see the mapping below.
2. Guest RSVP lists show the guest's email to leads only.
3. Deleting a contact permanently requires typing DELETE.
4. The UI is in English only, and dates use the "Tue 21 Oct" format.
5. The brand uses Shelfie's violet accent and rounded type, unchanged, as requested. Replace the tokens if FaithTech brand colours are supplied.

## Agile decisions → mocks

| Decision | Where to see it |
|---|---|
| City Lead creates and owns workspaces and picks the members | `workspaces/default`, `dialogs/create-workspace`, `workspace-settings`, `dialogs/add-workspace-member` |
| Members are anyone with a lead or volunteer role | The member picker in the dialogs, `team-board/member` (Ruth, a Volunteer) |
| Member rights vs owner-only actions | `team-board/member`, `dialogs/new-work-item/member`, `workspace-settings/forbidden` |
| Staff read-only, System Admin override, non-members see nothing (search too) | The `staff` and `forbidden` states, `search/member` vs `search/default`, `dialogs/reassign-owner` |
| Scrum or Kanban per workspace, switchable; switching closes the sprints | `team-board/default` vs `kanban`, `dialogs/switch-method` |
| Strict Initiative → Epic → Story → Task hierarchy, optional parents, a task needs a story | `backlog/default` (orphan epic and story), `dialogs/new-work-item/task` and `invalid` |
| Stories are the cards, tasks a checklist; To Do → In Progress → Done; filter by epic/initiative | `team-board/*`, `dialogs/move-story`, `work-item/default`, the epic filter on the Kanban board and backlog |
| Fields: title, description, one assignee, status, points, comments | `work-item/default` |
| Sprints: name, goal, dates; one active; unfinished stories return to the backlog; completed points | `dialogs/start-sprint`, `dialogs/close-sprint`, `backlog/sprints` |
| Planning Poker: any member starts a live session; deck 1–21 and ?; hidden votes; re-vote; facilitator sets the points | `dialogs/start-poker`, `planning-poker/default`, `revealed`, `facilitator`, `agreed` |
| Notifications: assigned, added to a workspace, poker invite | `notifications/bell/agile`, `notifications/email/assigned`, `workspace-added` and `poker-invite`, `pages/notifications/default` |
| Archive and restore; a removed member's items become unassigned; System Admin reassigns ownership | `dialogs/archive-work-item`, `archive-workspace`, `remove-workspace-member`, `reassign-owner`, the Archived section of `workspace-settings` |

## Re-check and re-screenshot

```sh
python .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks --write
python .claude/skills/writing-html-mocks/scripts/screenshot_mocks.py docs/mocks
```

Screenshots go to `docs/mocks/.cache/` (git-ignored).

## Coverage

<!-- coverage:start -->

Legend: ✅ mock exists · ➖ not applicable (reason in manifest) · ❌ missing

### Pages

| Screen | default | loading | empty | error | invalid | busy | locked | suspended | success | existing | sign-in | wrong-account | activity-error | pipeline-zero | pipeline-error | staff | coming-up-empty | admin | own | no-role | not-found | uploading | too-large | wrong-type | pending | storing | full | forbidden | member | short | no-results | rsvped | lead | link-copied | cancelled | edit | no-notes | match | linked | missing | duplicate | read-only | dragging | tabs | more | more-error | event | unread | exporting | exported | export-failed | empty-member | archived | needs-owner | kanban | phone | sprints | not-in-sprint | revealed | facilitator | agreed | withdrawn | vote-failed | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Sign in (`sign-in`) | [✅](pages/sign-in/default.html) | ➖ | ➖ | [✅](pages/sign-in/error.html) | [✅](pages/sign-in/invalid.html) | [✅](pages/sign-in/busy.html) | [✅](pages/sign-in/locked.html) | [✅](pages/sign-in/suspended.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-003` |
| Sign up (`sign-up`) | [✅](pages/sign-up/default.html) | ➖ | ➖ | [✅](pages/sign-up/error.html) | [✅](pages/sign-up/invalid.html) | [✅](pages/sign-up/busy.html) |  |  | [✅](pages/sign-up/success.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-001` |
| Verify email (`verify-email`) | [✅](pages/verify-email/default.html) | ➖ | ➖ | [✅](pages/verify-email/error.html) |  |  |  |  | [✅](pages/verify-email/success.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-002` |
| Forgot password (`forgot-password`) | [✅](pages/forgot-password/default.html) | ➖ | ➖ | [✅](pages/forgot-password/error.html) | [✅](pages/forgot-password/invalid.html) |  |  |  | [✅](pages/forgot-password/success.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-004` |
| Reset password (`reset-password`) | [✅](pages/reset-password/default.html) | ➖ | ➖ | [✅](pages/reset-password/error.html) | [✅](pages/reset-password/invalid.html) |  |  |  | [✅](pages/reset-password/success.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-004` |
| Accept invite (`accept-invite`) | [✅](pages/accept-invite/default.html) | ➖ | ➖ | [✅](pages/accept-invite/error.html) | [✅](pages/accept-invite/invalid.html) |  |  |  |  | [✅](pages/accept-invite/existing.html) | [✅](pages/accept-invite/sign-in.html) | [✅](pages/accept-invite/wrong-account.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-001`, `L2-011` |
| Unsubscribe (`unsubscribe`) | [✅](pages/unsubscribe/default.html) | ➖ | ➖ | [✅](pages/unsubscribe/error.html) |  | [✅](pages/unsubscribe/busy.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-030` |
| Home (`home`) | [✅](pages/home/default.html) | [✅](pages/home/loading.html) | [✅](pages/home/empty.html) | [✅](pages/home/error.html) |  |  |  |  |  |  |  |  | [✅](pages/home/activity-error.html) | [✅](pages/home/pipeline-zero.html) | [✅](pages/home/pipeline-error.html) | [✅](pages/home/staff.html) | [✅](pages/home/coming-up-empty.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-049` |
| Profile (`profile`) | [✅](pages/profile/default.html) | [✅](pages/profile/loading.html) | [✅](pages/profile/empty.html) | [✅](pages/profile/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/profile/admin.html) | [✅](pages/profile/own.html) | [✅](pages/profile/no-role.html) | [✅](pages/profile/not-found.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-005`, `L2-007`, `L2-040` |
| Edit profile (`edit-profile`) | [✅](pages/edit-profile/default.html) | [✅](pages/edit-profile/loading.html) | [✅](pages/edit-profile/empty.html) | [✅](pages/edit-profile/error.html) | [✅](pages/edit-profile/invalid.html) | [✅](pages/edit-profile/busy.html) |  |  | [✅](pages/edit-profile/success.html) |  |  |  |  |  |  |  |  | [✅](pages/edit-profile/admin.html) |  |  |  | [✅](pages/edit-profile/uploading.html) | [✅](pages/edit-profile/too-large.html) | [✅](pages/edit-profile/wrong-type.html) | [✅](pages/edit-profile/pending.html) | [✅](pages/edit-profile/storing.html) | [✅](pages/edit-profile/full.html) | [✅](pages/edit-profile/forbidden.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-006`, `L2-007`, `L2-040` |
| Search (`search`) | [✅](pages/search/default.html) | [✅](pages/search/loading.html) | [✅](pages/search/empty.html) | [✅](pages/search/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/search/member.html) | [✅](pages/search/short.html) | [✅](pages/search/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-026` |
| Events (`events`) | [✅](pages/events/default.html) | [✅](pages/events/loading.html) | [✅](pages/events/empty.html) | [✅](pages/events/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/events/member.html) |  | [✅](pages/events/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-021` |
| Event (`event`) | [✅](pages/event/default.html) | [✅](pages/event/loading.html) | ➖ | [✅](pages/event/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/event/rsvped.html) | [✅](pages/event/lead.html) | [✅](pages/event/link-copied.html) | [✅](pages/event/cancelled.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-022`, `L2-024`, `L2-025` |
| Public event page (`public-event`) | [✅](pages/public-event/default.html) | [✅](pages/public-event/loading.html) | ➖ | [✅](pages/public-event/error.html) | [✅](pages/public-event/invalid.html) |  |  |  | [✅](pages/public-event/success.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/public-event/full.html) |  |  |  |  |  |  |  | [✅](pages/public-event/cancelled.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-023`, `L2-024` |
| Cancel a guest RSVP (`guest-cancel-rsvp`) | [✅](pages/guest-cancel-rsvp/default.html) | ➖ | ➖ | [✅](pages/guest-cancel-rsvp/error.html) | [✅](pages/guest-cancel-rsvp/invalid.html) | [✅](pages/guest-cancel-rsvp/busy.html) |  |  | [✅](pages/guest-cancel-rsvp/success.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-023` |
| Create / edit event (`event-form`) | [✅](pages/event-form/default.html) | [✅](pages/event-form/loading.html) | ➖ | [✅](pages/event-form/error.html) | [✅](pages/event-form/invalid.html) | [✅](pages/event-form/busy.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/event-form/edit.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-020` |
| Contacts (`contacts`) | [✅](pages/contacts/default.html) | [✅](pages/contacts/loading.html) | [✅](pages/contacts/empty.html) | [✅](pages/contacts/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/contacts/forbidden.html) |  |  | [✅](pages/contacts/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-012`, `L2-013` |
| Contact detail (`contact`) | [✅](pages/contact/default.html) | [✅](pages/contact/loading.html) | ➖ | [✅](pages/contact/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/contact/no-notes.html) | [✅](pages/contact/match.html) | [✅](pages/contact/linked.html) | [✅](pages/contact/missing.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-012`, `L2-014`, `L2-015` |
| Add / edit contact (`contact-form`) | [✅](pages/contact-form/default.html) | ➖ | ➖ | [✅](pages/contact-form/error.html) | [✅](pages/contact-form/invalid.html) | [✅](pages/contact-form/busy.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/contact-form/edit.html) |  |  |  |  | [✅](pages/contact-form/duplicate.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-013` |
| Archived contacts (`archived-contacts`) | [✅](pages/archived-contacts/default.html) | [✅](pages/archived-contacts/loading.html) | [✅](pages/archived-contacts/empty.html) | [✅](pages/archived-contacts/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-016` |
| Partner pipeline (`partners`) | [✅](pages/partners/default.html) | [✅](pages/partners/loading.html) | [✅](pages/partners/empty.html) | [✅](pages/partners/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/partners/read-only.html) | [✅](pages/partners/dragging.html) | [✅](pages/partners/tabs.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-017`, `L2-018` |
| Partner detail (`partner`) | [✅](pages/partner/default.html) | [✅](pages/partner/loading.html) | ➖ | [✅](pages/partner/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-017`, `L2-018` |
| Edit partner (`partner-form`) | [✅](pages/partner-form/default.html) | [✅](pages/partner-form/loading.html) | ➖ | [✅](pages/partner-form/error.html) | [✅](pages/partner-form/invalid.html) | [✅](pages/partner-form/busy.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-017` |
| Team (`team`) | [✅](pages/team/default.html) | [✅](pages/team/loading.html) | [✅](pages/team/empty.html) | [✅](pages/team/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/team/member.html) |  | [✅](pages/team/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/team/more.html) | [✅](pages/team/more-error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-019` |
| People and roles (`people`) | [✅](pages/people/default.html) | [✅](pages/people/loading.html) | ➖ | [✅](pages/people/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/people/admin.html) |  |  |  |  |  |  |  |  |  | [✅](pages/people/forbidden.html) |  |  | [✅](pages/people/no-results.html) |  |  |  |  |  |  |  |  |  |  | [✅](pages/people/read-only.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-009`, `L2-053` |
| Invites (`invites`) | [✅](pages/invites/default.html) | [✅](pages/invites/loading.html) | [✅](pages/invites/empty.html) | [✅](pages/invites/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/invites/more.html) | [✅](pages/invites/more-error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-010` |
| Announcements (`announcements`) | [✅](pages/announcements/default.html) | [✅](pages/announcements/loading.html) | [✅](pages/announcements/empty.html) | [✅](pages/announcements/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-030` |
| Compose announcement (`compose-announcement`) | [✅](pages/compose-announcement/default.html) | ➖ | ➖ | [✅](pages/compose-announcement/error.html) | [✅](pages/compose-announcement/invalid.html) | [✅](pages/compose-announcement/busy.html) |  |  | [✅](pages/compose-announcement/success.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/compose-announcement/event.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-029` |
| Notifications (`notifications`) | [✅](pages/notifications/default.html) | [✅](pages/notifications/loading.html) | [✅](pages/notifications/empty.html) | [✅](pages/notifications/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/notifications/unread.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-027` |
| Settings (`settings`) | [✅](pages/settings/default.html) | [✅](pages/settings/loading.html) | ➖ | [✅](pages/settings/error.html) | [✅](pages/settings/invalid.html) | [✅](pages/settings/busy.html) |  |  | [✅](pages/settings/success.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-030`, `L2-052`, `L2-045` |
| Admin · Users (`admin-users`) | [✅](pages/admin-users/default.html) | [✅](pages/admin-users/loading.html) | ➖ | [✅](pages/admin-users/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/admin-users/forbidden.html) |  |  | [✅](pages/admin-users/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-037`, `L2-039`, `L2-040` |
| Admin · Audit log (`audit-log`) | [✅](pages/audit-log/default.html) | [✅](pages/audit-log/loading.html) | [✅](pages/audit-log/empty.html) | [✅](pages/audit-log/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/audit-log/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/audit-log/exporting.html) | [✅](pages/audit-log/exported.html) | [✅](pages/audit-log/export-failed.html) |  |  |  |  |  |  |  |  |  |  |  |  | `L2-041` |
| Not found (`not-found`) | [✅](pages/not-found/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-048` |
| Forbidden (`forbidden`) | [✅](pages/forbidden/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-048` |
| Server error (`server-error`) | [✅](pages/server-error/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-048` |
| Offline (`offline`) | [✅](pages/offline/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-048` |
| Workspaces (`workspaces`) | [✅](pages/workspaces/default.html) | [✅](pages/workspaces/loading.html) | [✅](pages/workspaces/empty.html) | [✅](pages/workspaces/error.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/workspaces/staff.html) |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/workspaces/member.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/workspaces/empty-member.html) | [✅](pages/workspaces/archived.html) |  |  |  |  |  |  |  |  |  |  | `L2-050` |
| Workspace settings (`workspace-settings`) | [✅](pages/workspace-settings/default.html) | [✅](pages/workspace-settings/loading.html) | ➖ | [✅](pages/workspace-settings/error.html) | [✅](pages/workspace-settings/invalid.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/workspace-settings/forbidden.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/workspace-settings/needs-owner.html) |  |  |  |  |  |  |  |  |  | `L2-036`, `L2-037`, `L2-051` |
| Board (`team-board`) | [✅](pages/team-board/default.html) | [✅](pages/team-board/loading.html) | [✅](pages/team-board/empty.html) | [✅](pages/team-board/error.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/team-board/staff.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/team-board/forbidden.html) | [✅](pages/team-board/member.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/team-board/kanban.html) | [✅](pages/team-board/phone.html) |  |  |  |  |  |  |  | `L2-031`, `L2-034`, `L2-035` |
| Backlog (`backlog`) | [✅](pages/backlog/default.html) | [✅](pages/backlog/loading.html) | [✅](pages/backlog/empty.html) | [✅](pages/backlog/error.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/backlog/staff.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/backlog/forbidden.html) | [✅](pages/backlog/member.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/backlog/sprints.html) |  |  |  |  |  |  | `L2-031`, `L2-032`, `L2-035` |
| Story (`work-item`) | [✅](pages/work-item/default.html) | [✅](pages/work-item/loading.html) | [✅](pages/work-item/empty.html) | [✅](pages/work-item/error.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/work-item/staff.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/work-item/forbidden.html) | [✅](pages/work-item/member.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/work-item/not-in-sprint.html) |  |  |  |  |  | `L2-032`, `L2-033`, `L2-037` |
| Planning Poker (`planning-poker`) | [✅](pages/planning-poker/default.html) | [✅](pages/planning-poker/loading.html) | [✅](pages/planning-poker/empty.html) | [✅](pages/planning-poker/error.html) | [✅](pages/planning-poker/invalid.html) |  |  |  |  |  |  |  |  |  |  | [✅](pages/planning-poker/staff.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/planning-poker/forbidden.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/planning-poker/revealed.html) | [✅](pages/planning-poker/facilitator.html) | [✅](pages/planning-poker/agreed.html) | [✅](pages/planning-poker/withdrawn.html) | [✅](pages/planning-poker/vote-failed.html) | `L2-038` |

### Dialogs

| Screen | default | busy | invalid | failed | member | task | invalid-title | edit | to-scrum | limited | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Create workspace (`create-workspace`) | [✅](dialogs/create-workspace/default.html) | [✅](dialogs/create-workspace/busy.html) | [✅](dialogs/create-workspace/invalid.html) | [✅](dialogs/create-workspace/failed.html) |  |  |  |  |  |  | `L2-031` |
| Add workspace members (`add-workspace-member`) | [✅](dialogs/add-workspace-member/default.html) | [✅](dialogs/add-workspace-member/busy.html) | [✅](dialogs/add-workspace-member/invalid.html) | [✅](dialogs/add-workspace-member/failed.html) |  |  |  |  |  |  | `L2-031` |
| Remove workspace member (`remove-workspace-member`) | [✅](dialogs/remove-workspace-member/default.html) | [✅](dialogs/remove-workspace-member/busy.html) | ➖ | [✅](dialogs/remove-workspace-member/failed.html) |  |  |  |  |  |  | `L2-031` |
| Archive workspace (`archive-workspace`) | [✅](dialogs/archive-workspace/default.html) | [✅](dialogs/archive-workspace/busy.html) | ➖ | [✅](dialogs/archive-workspace/failed.html) |  |  |  |  |  |  | `L2-037` |
| Archive work item (`archive-work-item`) | [✅](dialogs/archive-work-item/default.html) | [✅](dialogs/archive-work-item/busy.html) | ➖ | [✅](dialogs/archive-work-item/failed.html) |  |  |  |  |  |  | `L2-037` |
| New work item (`new-work-item`) | [✅](dialogs/new-work-item/default.html) | [✅](dialogs/new-work-item/busy.html) | [✅](dialogs/new-work-item/invalid.html) | [✅](dialogs/new-work-item/failed.html) | [✅](dialogs/new-work-item/member.html) | [✅](dialogs/new-work-item/task.html) | [✅](dialogs/new-work-item/invalid-title.html) | [✅](dialogs/new-work-item/edit.html) |  |  | `L2-032`, `L2-033` |
| Start sprint (`start-sprint`) | [✅](dialogs/start-sprint/default.html) | [✅](dialogs/start-sprint/busy.html) | [✅](dialogs/start-sprint/invalid.html) | [✅](dialogs/start-sprint/failed.html) |  |  |  |  |  |  | `L2-035` |
| Close sprint (`close-sprint`) | [✅](dialogs/close-sprint/default.html) | [✅](dialogs/close-sprint/busy.html) | ➖ | [✅](dialogs/close-sprint/failed.html) |  |  |  |  |  |  | `L2-035` |
| Move story (`move-story`) | [✅](dialogs/move-story/default.html) | [✅](dialogs/move-story/busy.html) | ➖ | [✅](dialogs/move-story/failed.html) |  |  |  |  |  |  | `L2-034` |
| Switch Scrum / Kanban (`switch-method`) | [✅](dialogs/switch-method/default.html) | [✅](dialogs/switch-method/busy.html) | ➖ | [✅](dialogs/switch-method/failed.html) |  |  |  |  | [✅](dialogs/switch-method/to-scrum.html) |  | `L2-036` |
| Start Planning Poker (`start-poker`) | [✅](dialogs/start-poker/default.html) | [✅](dialogs/start-poker/busy.html) | [✅](dialogs/start-poker/invalid.html) | [✅](dialogs/start-poker/failed.html) |  |  |  |  |  |  | `L2-038` |
| Reassign workspace owner (`reassign-owner`) | [✅](dialogs/reassign-owner/default.html) | [✅](dialogs/reassign-owner/busy.html) | [✅](dialogs/reassign-owner/invalid.html) | [✅](dialogs/reassign-owner/failed.html) |  |  |  |  |  |  | `L2-037` |
| Cancel event (`cancel-event`) | [✅](dialogs/cancel-event/default.html) | [✅](dialogs/cancel-event/busy.html) | [✅](dialogs/cancel-event/invalid.html) | [✅](dialogs/cancel-event/failed.html) |  |  |  |  |  |  | `L2-025` |
| Cancel RSVP (`cancel-rsvp`) | [✅](dialogs/cancel-rsvp/default.html) | [✅](dialogs/cancel-rsvp/busy.html) | ➖ | [✅](dialogs/cancel-rsvp/failed.html) |  |  |  |  |  |  | `L2-022` |
| Sign out everywhere (`sign-out-everywhere`) | [✅](dialogs/sign-out-everywhere/default.html) | [✅](dialogs/sign-out-everywhere/busy.html) | ➖ | [✅](dialogs/sign-out-everywhere/failed.html) |  |  |  |  |  |  | `L2-052` |
| Add note (`add-note`) | [✅](dialogs/add-note/default.html) | [✅](dialogs/add-note/busy.html) | [✅](dialogs/add-note/invalid.html) | [✅](dialogs/add-note/failed.html) |  |  |  |  |  |  | `L2-014` |
| Archive contact (`archive-contact`) | [✅](dialogs/archive-contact/default.html) | [✅](dialogs/archive-contact/busy.html) | ➖ | [✅](dialogs/archive-contact/failed.html) |  |  |  |  |  |  | `L2-016` |
| Delete contact permanently (`delete-contact`) | [✅](dialogs/delete-contact/default.html) | [✅](dialogs/delete-contact/busy.html) | [✅](dialogs/delete-contact/invalid.html) | [✅](dialogs/delete-contact/failed.html) |  |  |  |  |  |  | `L2-016` |
| Link contact to profile (`link-contact`) | [✅](dialogs/link-contact/default.html) | [✅](dialogs/link-contact/busy.html) | ➖ | [✅](dialogs/link-contact/failed.html) |  |  |  |  |  |  | `L2-015` |
| Add role (`add-role`) | [✅](dialogs/add-role/default.html) | [✅](dialogs/add-role/busy.html) | [✅](dialogs/add-role/invalid.html) | [✅](dialogs/add-role/failed.html) |  |  |  |  |  |  | `L2-009` |
| Remove role (`remove-role`) | [✅](dialogs/remove-role/default.html) | [✅](dialogs/remove-role/busy.html) | ➖ | [✅](dialogs/remove-role/failed.html) |  |  |  |  |  |  | `L2-009` |
| Send invite (`send-invite`) | [✅](dialogs/send-invite/default.html) | [✅](dialogs/send-invite/busy.html) | [✅](dialogs/send-invite/invalid.html) | [✅](dialogs/send-invite/failed.html) |  |  |  |  |  | [✅](dialogs/send-invite/limited.html) | `L2-010` |
| Suspend user (`suspend-user`) | [✅](dialogs/suspend-user/default.html) | [✅](dialogs/suspend-user/busy.html) | [✅](dialogs/suspend-user/invalid.html) | [✅](dialogs/suspend-user/failed.html) |  |  |  |  |  |  | `L2-039` |
| Delete photo (`delete-photo`) | [✅](dialogs/delete-photo/default.html) | [✅](dialogs/delete-photo/busy.html) | ➖ | [✅](dialogs/delete-photo/failed.html) |  |  |  |  |  |  | `L2-007` |
| Move partner stage (`move-partner`) | [✅](dialogs/move-partner/default.html) | [✅](dialogs/move-partner/busy.html) | ➖ | [✅](dialogs/move-partner/failed.html) |  |  |  |  |  |  | `L2-018` |
| Move card (`move-card`) | [✅](dialogs/move-card/default.html) | [✅](dialogs/move-card/busy.html) | ➖ | [✅](dialogs/move-card/failed.html) |  |  |  |  |  |  | `L2-034` |
| Add partner (`add-partner`) | [✅](dialogs/add-partner/default.html) | [✅](dialogs/add-partner/busy.html) | [✅](dialogs/add-partner/invalid.html) | [✅](dialogs/add-partner/failed.html) |  |  |  |  |  |  | `L2-017` |

### Notifications

| Screen | info | success | warning | danger | stacked | unread | agile | empty | announcement | assigned | workspace-added | poker-invite | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Toast (`toast`) | [✅](notifications/toast/info.html) | [✅](notifications/toast/success.html) | [✅](notifications/toast/warning.html) | [✅](notifications/toast/danger.html) | [✅](notifications/toast/stacked.html) |  |  |  |  |  |  |  | `L2-054` |
| Banner (`banner`) | [✅](notifications/banner/info.html) | [✅](notifications/banner/success.html) | [✅](notifications/banner/warning.html) | [✅](notifications/banner/danger.html) |  |  |  |  |  |  |  |  | `L2-002`, `L2-039`, `L2-054` |
| Notification bell (`bell`) | [✅](notifications/bell/info.html) | [✅](notifications/bell/success.html) | [✅](notifications/bell/warning.html) | [✅](notifications/bell/danger.html) |  | [✅](notifications/bell/unread.html) | [✅](notifications/bell/agile.html) | [✅](notifications/bell/empty.html) |  |  |  |  | `L2-027` |
| Email (`email`) | [✅](notifications/email/info.html) | [✅](notifications/email/success.html) | [✅](notifications/email/warning.html) | [✅](notifications/email/danger.html) |  |  |  |  | [✅](notifications/email/announcement.html) | [✅](notifications/email/assigned.html) | [✅](notifications/email/workspace-added.html) | [✅](notifications/email/poker-invite.html) | `L2-028`, `L2-030` |

<!-- coverage:end -->
