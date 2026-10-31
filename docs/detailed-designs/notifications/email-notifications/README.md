# Email notifications

## Overview

The Community platform sends email on behalf of the organisation an occurrence was raised in (`L2-130` AC6) for the occurrences listed in `L2-028`: a contact signed up, an event cancelled or changed, invites, RSVP confirmations, role changes, Agile assignments and workspace additions, Planning Poker invitations, announcements, a resource shared with you and a resource handed to you. This feature describes the shared outbound email pipeline that every one of those sources uses.

- **email outbox** — table of rendered emails waiting to be delivered, written in the same transaction as the action that triggered them
- **delivery worker** — background service that reads the outbox and hands each message to the email provider
- **announcement opt-out** — member preference that suppresses announcement emails only

The outbox decouples the triggering action from delivery. The triggering action succeeds even when the email provider is unavailable, and the worker retries delivery later (`L2-047`).

## Description

- **`IEmailQueue`** — Application abstraction. `Enqueue(EmailMessage)` adds a message to the outbox inside the caller's unit of work, so it is saved with the action that raised it.
- **`EmailMessage`** — record with `To`, `Subject`, the plain-text `Body`, optional `Attachments` (an RSVP's `.ics`) and `HtmlBody`.
- **`IEmailSender`** / **`OutboxEmailSender`** — the single-email entry point only the identity flows use (verification and password reset): Identity has already saved the account before the token exists, and those emails can be requested again, so this enqueues and saves at once. Every action that changes community data (invites, role changes, contact sign-ups, RSVPs, event cancellation, Agile notifications, announcements) queues through `IEmailQueue` before its own save, so the action and its email commit together or not at all (`L2-047`).
- **`OutboxEmailQueue`** — Infrastructure implementation of `IEmailQueue`. It renders the HTML part with `EmailTemplateRenderer` unless the message brings one.
- **`EmailTemplateRenderer`** — Infrastructure renderer that turns the plain-text body into the HTML part with the design system's `.email` classes (`docs/design-system/patterns/notifications.html`): a paragraph that is only a URL becomes the "Open in {organisation short name}" button (`L2-134` AC5), and a line "Label: URL" becomes a link named Label. Every style is read from the light-theme tokens in `tokens.css`, which the Infrastructure assembly embeds at build time, so no colour, size or font is typed into it. Text is HTML-encoded.
- **`OutboxMessage`** — Infrastructure persistence entity (`OutboxMessages` table) with `OrganisationId` (the organisation whose name and host the message carries; the row is written under the global filter on `ICurrentOrganisation`), `Body`, `HtmlBody`, `AttachmentsJson`, `Attempts`, `NextAttemptAt`, `SentAt`, `FailedAt` (terminal: the retry budget is spent) and `LastError`.
- **`EmailOutboxDispatcher`** / **`EmailOutboxWorker`** — the hosted background service in Infrastructure polls due outbox rows, hands each to `IEmailTransport`, and on failure schedules a retry with backoff, up to 5 attempts in all including the first send, after which the row is marked failed.
- **`IEmailTransport`** / **`SmtpEmailTransport`** — Infrastructure transport that delivers through SMTP, which covers the SendGrid relay. It sends the plain-text part with the HTML part as its alternative.
- **`INotificationPublisher.PublishAsync`** — Application service that writes the in-app `Notification` for each recipient and, for sources with an email form, enqueues one email per recipient with the link to the item appended on the organisation's community host, and the sender display name, subject prefix and footer carrying the organisation's name (`L2-130` AC6, `L2-134` AC5). For `NotificationKind.Announcement` it skips recipients whose `AnnouncementEmailsOptedOut` flag is set; every other kind always emails.
- **`WebAppOptions`** — `WebApp:Origin` names the platform's default host and is validated at start-up: outside Development the API refuses to start unless it is an `https://` URL. Links are built on the current organisation's host from `ICurrentOrganisation`, which is `https://` by the same rule, so every link in an email uses HTTPS and points at that host (`L2-028` AC2).

The worker polls every 10 seconds (`Outbox:IntervalSeconds`), so a newly queued email is first sent within 2 minutes whenever the provider is healthy. The retry budget is **5 delivery attempts in all, counting the first send** (`EmailOutboxDispatcher.MaxAttempts`). After failed attempt *n* the next attempt is due 2<sup>*n*</sup> minutes later, capped at one hour, so the attempts fall at about 0, 2, 6, 14 and 30 minutes. When the fifth attempt fails, the row gets `FailedAt` and the dispatcher never selects it again. The failure stays observable in the outbox row (`Attempts`, `FailedAt`, `LastError` with the recipient address replaced by `[recipient]`) and in an error log entry that names only the message id. A message sent within the budget gets `SentAt` and is never dispatched again.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-028` | `L1-010` | Email notifications |
| `L2-134` | `L1-025` | Organisation name in copy and email |

### Acceptance criteria

**`L2-028` — Email notifications**

These emails are sent: a contact signed up, an event cancelled or changed, invites, RSVP confirmations, role changes, Agile assignments and workspace additions, Planning Poker invitations, announcements, a resource shared with you and a resource handed to you (`L2-061`, `L2-064`). Only announcement emails can be turned off. Every email is sent on behalf of the organisation it was raised in (`L2-130` AC6, `L2-134` AC5).

1. Given a triggering action, when it completes, then the email is queued and sent within 2 minutes, retrying on failure for up to 5 delivery attempts in all, counting the first send, after which it is marked failed and not retried.
2. Given an email, when it is rendered, then it includes a plain-text part, every link uses HTTPS and points at the organisation's host, and its sender display name, subject prefix and footer carry the organisation's name (`L2-130` AC6, `L2-134` AC5).
3. Given a user who opted out of announcement emails, when an announcement is sent, then no announcement email reaches them, but other notification emails still do.

**`L2-134` — Organisation name in copy and email**

1. Given any page, dialog, toast, empty state, error message, email subject or email body that names the product, when it renders, then it uses the organisation's name or short name from `/api/me` or the organisation record, never a fixed name ("We couldn't reach {short name}", "Join {name}", "{name} headline", "Hosted by {name}" on public event pages).
2. Given the HTML document title, when any route renders, then it is "{page} · {organisation short name}".
3. Given the public marketing page (`L2-074`), when it is served on an organisation's public host, then its headline, name, brochure video and footer come from the configuration entry for that host; a public host with no entry shows the unknown-host page.
4. Given the `.ics` download (`L2-024`), when it is generated, then `PRODID` and the organiser name carry the organisation's name.
5. Given the invite, announcement, notification and verification emails, when they are rendered, then "{organisation name}" replaces every product name and the links point at the organisation's community host.

## Diagrams

### System context

The Community platform sends notification email to members, on behalf of their organisation, through an external email provider.

![C4 system context for email notifications](diagrams/c4-context.png)

### Containers

The Community API writes emails to an outbox in the Community database and delivers them to the email provider over SMTP.

![C4 container view for email notifications](diagrams/c4-container.png)

### Components

A triggering handler publishes through `INotificationPublisher`, which enqueues a rendered email. `EmailDeliveryWorker` later delivers it through `IEmailSender`.

![C4 component view for email notifications](diagrams/c4-component.png)

### Class structure

`OutboxEmail` owns an `EmailMessage` and tracks attempts and status. `INotificationPublisher` checks `AnnouncementEmailsOptedOut` before it enqueues an announcement.

![Class diagram for email notifications](diagrams/class-structure.png)

### Behaviour — deliver a notification email

The triggering action commits the outbox row with its own changes. The worker delivers it within 2 minutes and retries failures up to 5 times (`L2-028`).

![Sequence diagram for deliver a notification email](diagrams/sequence-deliver-email.png)
