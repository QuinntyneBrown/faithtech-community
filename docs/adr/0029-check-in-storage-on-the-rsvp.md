# 0029. Check-in storage on the RSVP

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-117, L2-118, L2-119, L2-120, L2-121, L2-122, L2-125, L2-022
- Design: `docs/detailed-designs/events/event-check-in`

## Context

Leads check attendees in at the door, add people who turn up without an RSVP, and export who came (`L2-117` to `L2-122`). Reports shows the share of RSVPs that were checked in (`L2-125`). Each check-in needs the time and who recorded it, must be undoable, and must not change the RSVP rules, counts or list that `L2-020` to `L2-024` already define. Questions: where a check-in lives, what a walk-in is, and when check-in may happen.

## Decision

- **A check-in is three columns on `Rsvp`**: `CheckedInAt` (nullable time stamp), `CheckedInById` (nullable profile id, no foreign key, like `Event.CancelledById`) and `IsWalkIn` (boolean, default false). Undo clears the first two. Checking in an attendee already checked in keeps the original time and person.
- **A walk-in is an `Rsvp` row** created at the door through `Event.AddWalkIn`, with `IsWalkIn = true`:
  - it skips the capacity and has-started rules that close RSVPs, and sends no confirmation;
  - its `GuestEmail` is optional (the column is already nullable; only `Event.GuestRsvp` requires an email);
  - an email that belongs to a verified account links the row to that member's `ProfileId` instead of storing a guest name and email;
  - an existing RSVP for that member or email is reused, keeping `IsWalkIn = false`, rather than a second row being created.
- **Walk-ins are not RSVPs for counting.** `Event.RsvpCount`, `Event.IsFull`, the event list count, the event page's RSVP list, the RSVP CSV and the Reports RSVP figure leave walk-in rows out. The check-in page and the attendance CSV include them.
- **The check-in window** opens 24 hours before `StartsAt` and does not close. A cancelled event has no window. Check-in, undo and adding a walk-in outside the window answer `409`.
- **Who** follows `L2-022`: lead roles and System Admin write and export; Staff read without guest emails; a System Admin without a lead role is audited for each write.

## Consequences

- One table answers "who said they would come" and "who came", so the check-in list, the attendance export and the Reports check-in rate need no join and no second source of truth. Deleting an RSVP (a member cancelling) removes its check-in with it.
- The migration adds three columns with defaults; existing rows read as RSVP'd and not checked in. No data is moved.
- Every reader of `Rsvps` that counts RSVPs must filter `IsWalkIn`. `ListEventsHandler`, `GetEventHandler`, `RsvpHandler.ExportAsync` and the Reports queries do so; `SendAnnouncement`'s event audience deliberately includes member walk-ins.
- Only the latest check-in is kept: an undo leaves no history beyond the audit log for overrides. A separate `CheckIn` table with one row per action was rejected as more than v1 needs.
- A walk-in added and later found to be a duplicate of a guest RSVP under another email stays as two rows; the lead may undo one. Merging attendees is not in scope.
