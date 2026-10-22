# Read announcements and opt out

## Overview

Members read the announcements sent to them on the announcements page and decide whether announcements also arrive by email. This feature covers the reading list, the settings preference and the one-click unsubscribe link in each announcement email.

- **announcement email opt-out** — profile preference that stops announcement emails and leaves every other notification email in place
- **unsubscribe token** — signed, single-purpose value embedded in an announcement email link that identifies the recipient without a sign-in

The unsubscribe endpoint is one of the anonymous endpoints listed in `L2-042`.

## Description

- **`AnnouncementsPage`** — page in the `announcements` library (mock `pages/announcements`) listing the caller's announcements newest first.
- **`SettingsPage`** toggle — the "Announcement emails" switch on the settings screen (mock `pages/settings`) calls `AnnouncementsService.setEmailOptOut`. The `components` library provides the switch.
- **`AnnouncementsService`** / **`ANNOUNCEMENTS_SERVICE`** / **`HttpAnnouncementsService`** — client contract, token and implementation in the `api` library.
- **`AnnouncementsEndpoints`** — maps `GET /announcements`, `PUT /me/announcement-email-opt-out` and the anonymous `POST /announcements/unsubscribe`.
- **`ListMyAnnouncementsQuery`** / **`ListMyAnnouncementsHandler`** — joins `AnnouncementRecipient` on the caller and orders by `SentAt` descending.
- **`SetAnnouncementEmailOptOutCommand`** / **`SetAnnouncementEmailOptOutHandler`** — sets `Profile.AnnouncementEmailsOptedOut` for the caller.
- **`UnsubscribeFromAnnouncementsCommand`** / **`UnsubscribeFromAnnouncementsHandler`** — validates the token through `IUnsubscribeTokenService` and sets the opt-out for the profile it names.
- **`IUnsubscribeTokenService`** — Infrastructure service that issues and verifies tokens with ASP.NET Data Protection.

The token is time-limited to one year. The email link opens the anonymous `UnsubscribePage` (`/unsubscribe?token=`, mock `pages/unsubscribe`: default, success, error) in the `announcements` library, which posts the token; a `GET` never changes anything (ADR 0016).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-030` | `L1-011` | Read announcements and opt out |

### Acceptance criteria

**`L2-030` — Read announcements and opt out**

1. Given a member, when they open announcements, then they see the announcements sent to them, newest first.
2. Given settings, when a member turns off announcement emails, then the preference is saved and applies to the next send.
3. Given an announcement email, when the recipient follows its unsubscribe link, then they are opted out without signing in.

## Diagrams

### System context

A member reads announcements in FaithTech Community and receives announcement email, with an unsubscribe link, through the email provider.

![C4 system context for read announcements and opt out](diagrams/c4-context.png)

### Containers

The announcements page and settings live in the web app. The unsubscribe link reaches the Community API without a session.

![C4 container view for read announcements and opt out](diagrams/c4-container.png)

### Components

`AnnouncementsEndpoints` routes authenticated reads and preference changes to their handlers, and routes the anonymous unsubscribe to a handler that verifies the token first.

![C4 component view for read announcements and opt out](diagrams/c4-component.png)

### Class structure

`Profile` holds the opt-out flag. `AnnouncementRecipient` joins announcements to the profiles that received them.

![Class diagram for read announcements and opt out](diagrams/class-structure.png)

### Behaviour — read announcements and opt out in settings

The member reads announcements newest first, then turns off announcement emails in settings; the next send honours the change (`L2-030`).

![Sequence diagram for read announcements and opt out in settings](diagrams/sequence-read-and-opt-out.png)

### Behaviour — unsubscribe from an email link

The unsubscribe link carries a token that identifies the recipient, so the opt-out succeeds without a sign-in (`L2-030`).

![Sequence diagram for unsubscribe from an email link](diagrams/sequence-unsubscribe-link.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `Profile.SetAnnouncementEmailOptOut(bool)` stores the preference; it defaults to receiving announcement emails.
