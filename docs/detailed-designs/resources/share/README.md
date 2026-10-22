# Share resources with members and roles

## Overview

A **Shared** resource is visible to its owner, to the members it names and to whoever holds one of the roles it names, plus System Admin. Sharing is the Shared choice of the "Who can see it" picker in the add and edit dialogs; there is no separate share dialog. Everyone newly reached by a share gets a `ResourceShared` notification in-app and by email, in the same save as the share.

Key terms:

- **audience** — the named members (`ResourceShareMember`) and named roles (`ResourceShareRole`) of a Shared resource, held as the `ResourceAudience` value object
- **live role audience** — a role in the audience is evaluated against the caller's current roles on every request; whoever holds the role now may open the resource (`L2-060` AC8, ADR 0017)
- **recipients** — the members notified at save time: each named member plus every current holder of each named role, de-duplicated, excluding the owner and suspended members; a later audience change notifies only recipients who were not in the previous audience
- **no re-share** — a recipient can open and download the resource but cannot change its audience; only the owner and System Admin can

Visibility enforcement for Shared resources (`ResourceAccess.Visible`) is described in `resources/list-and-find`; the dialogs that host the picker are in `resources/add-and-edit`.

## Description

### Web app

- **"Share with" section** — part of `AddResourceDialog` and `EditResourceDialog` (mock `dialogs/add-resource/shared`), shown when Shared is chosen in the `ft-radio-group` "Who can see it". It holds an `ft-person-picker` labelled "People" in multiple mode (placeholder "Search members by name"; suggestions in a listbox "Matching members" show an `ft-avatar`, the name, and "{role} · {city}"; chosen members are removable chips "Remove {name}"), an `ft-checkbox-group` "Roles" (City Lead, Event Lead, Create Lead, Communications Lead, Volunteer, Product Engineer, Staff) and the caption "Everyone you add gets a notification. They can open and download it, but can’t share it on." The submit reads *Add and share* on add. With no member and no role, submitting shows "Choose at least one person or role, or pick another visibility." on the picker and in the error summary.
- **"Change who can see it"** — on `ResourcePage` for the owner and System Admin of a Shared resource; it opens `EditResourceDialog` with focus on the visibility picker (`L2-061` AC5).
- **`ResourcePage` audience** — the Details list shows "Shared — the people and roles below", then each role as "Everyone with the {role} role · Role · N people today" and each member as "Member · {city}" with an avatar, and the note "People you share with can open and download it, but can’t share it on." A recipient sees the banner "{Owner} shared this with {you | everyone who has the {role} role}. You can open and download it, but not share it on." and no edit, share or archive control (mock `pages/resource/shared`, `shared-with-you`).
- **Bell and email** — the `ResourceShared` notice "{Owner} shared {title} with you" links to `/resources/{id}` through the existing `NoticeListComponent` (mock `notifications/bell/resource-shared`); the email follows the `.email` pattern (mock `notifications/email/resource-shared`).
- **`HttpResourcesService.members(q)`** — calls `GET /api/resources/members?q=` for the people picker; `add`, `addLink` and `update` carry `visibility`, `memberIds` and `roles`.
- **Components** — new `PersonPickerComponent` `ft-person-picker` in `components` (design system `components/person-picker.html`): an APG combobox with list autocomplete over people, removable chips in multiple mode or one chosen person in single mode, `loading` and `empty` notes, error and disabled states. It takes the suggestions as an input and emits the query, so it makes no HTTP calls. `TagInputComponent` and `PersonPickerComponent` share the chip-in-field look (`.tag-input`) from the design system.

### Community API

- **`ResourcesEndpoints`** — `GET /api/resources/members?q=` answers up to 10 `ResourceMemberDto` (`profileId`, `name`, `initials`, `photoUrl`, `role`, `city`) for a contributor (`403` otherwise); add, add link and edit accept `visibility`, `memberIds` and `roles`.
- **`ResourceMembersHandler`** — `MembersAsync(q)`: active, verified members (not suspended) whose name matches, excluding the caller, with their highest role and home city for the suggestion line. `OwnerCandidatesAsync(q)` (System Admin only) is the same list restricted to contributors, used by ownership transfer (`resources/archive-and-transfer`).
- **`ResourceAudience`** — Domain value object: `Private()`, `Global()` or `Shared(members, roles)`; `Shared` with no member and no role is refused. Built from the request by the handlers after `ResourceDetailsValidator` checks that every role is one of the seven offered and every member id is an active member (`400` otherwise).
- **`Resource.SetAudience(audience)`** — replaces the `ResourceShareMember` and `ResourceShareRole` rows and returns the members and roles that were **not** in the previous audience. Changing to Private or Global clears the audience (`L2-061` AC6).
- **`ShareNotifier`** — Application service in `Resources/` called by `AddResourcesHandler`, `AddLinkHandler` and `EditResourceHandler` before their one save. It resolves the new recipients: the new members plus the current holders of the new roles (a query on profile roles), de-duplicated, minus the owner, minus suspended members, minus anyone who already had access through the previous audience. It then calls `INotificationPublisher.PublishAsync(recipients, NotificationKind.ResourceShared, "{Owner} shared {title} with you", "/resources/{id}", ownerId, email)` where the email is subject "{Owner} shared {title} with you", heading "A resource was shared with you", body "{Owner} shared “{title}” ({Type}, {EXT}, {size}) with {you | everyone who has the {role} role, which includes you}." and the button "Open the resource". `ResourceShared` is an activity email, not an announcement, so the announcement opt-out does not apply (`L2-061` AC2). The notifications and queued emails join the same unit of work as the resource, so the share and its notifications commit together (`L2-028`).
- **Re-share refused** — a recipient is not the owner, so `ResourceAccess.CanEdit` is false and `PUT /api/resources/{id}` answers `403` (`L2-061` AC4). A System Admin changing someone else's audience is audited as `resource.shared` with the before and after audience.
- **Live roles** — no snapshot of role holders is stored. `ResourceAccess.Visible` joins `ResourceShareRoles` against the caller's roles from `ICurrentUser`, so a member who gains a role sees the resource on their next request without a notification, and one who loses it does not (`L2-061` AC3, `L2-060` AC8).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-061` | `L1-020` | Share with members and roles |

The `ResourceShared` kind also extends the notification sources of `L2-027` (in-app) and `L2-028` (email).

### Acceptance criteria

**`L2-061` — Share with members and roles**

1. Given Shared is chosen in the add or edit dialog, when the form renders, then a "Share with" section offers a people picker ("Search members by name", suggestions show name, role and city, chosen members appear as removable chips) and a checkbox group of roles (City Lead, Event Lead, Create Lead, Communications Lead, Volunteer, Product Engineer, Staff), with "Everyone you add gets a notification. They can open and download it, but can’t share it on.", and the submit reads "Add and share".
2. Given a resource is saved as Shared, when the save completes, then every recipient (each named member plus every current holder of each named role, de-duplicated, excluding the owner and suspended members) gets the in-app notification "{Owner} shared {title} with you", linking to the resource, and an email with the subject "{Owner} shared {title} with you", the heading "A resource was shared with you", the body "{Owner} shared “{title}” ({Type}, {EXT}, {size}) with {you | everyone who has the {role} role, which includes you}." and the button "Open the resource", in the same save (`L2-028`); this email cannot be turned off.
3. Given the audience of a Shared resource is changed, when the save completes, then only recipients who were not in the previous audience are notified; a member who gains a shared role later may open the resource at once (`L2-060` AC8) and gets no notification.
4. Given a member who may open a Shared resource but does not own it, when they view it, then no share, edit or archive control is rendered, and any attempt to change its audience through the API answers 403.
5. Given the audience section on the resource page, when the owner chooses "Change who can see it", then the edit dialog opens on the visibility picker (`L2-062`).
6. Given a Shared resource is changed to Global or Private, when the save completes, then the audience is cleared and no notification is sent.

## Diagrams

### System context

The owner shares a resource with members and roles; recipients are told in the app and by email through the email provider.

![C4 system context for share resources](diagrams/c4-context.png)

### Containers

The dialogs send the audience with the add or edit request. The API saves the audience, the in-app notifications and the queued emails in one transaction; the outbox worker sends the emails.

![C4 container view for share resources](diagrams/c4-container.png)

### Components

`ShareNotifier` resolves the new recipients and publishes through `INotificationPublisher`; `ResourceMembersHandler` feeds the people picker.

![C4 component view for share resources](diagrams/c4-component.png)

### Class structure

`ResourceAudience` is the value the handlers pass to `Resource.SetAudience`, which returns what is new. `ShareNotifier` turns that into recipients.

![Class diagram for share resources](diagrams/class-structure.png)

### Behaviour — share and notify

Saving a Shared resource stores the audience and notifies only the new recipients, in the same save.

![Sequence diagram for share and notify](diagrams/sequence-share-and-notify.png)

### Behaviour — a role audience follows role changes

A role named in the audience is matched against the caller's roles on every request, so gaining or losing the role changes what they can open, with no change to the resource and no notification.

![Sequence diagram for live role audience](diagrams/sequence-role-audience.png)

## Open questions

Decisions recorded for this design ([ADR 0017](../../../adr/0017-resources-storage-access-and-lifecycle.md)):

- A role in a Shared audience is live, not a snapshot: a shared resource is a standing permission, unlike an announcement, which is a message delivered once. Notifications are the only snapshot. Resolved.
- Sharing lives in the add and edit dialogs ("Who can see it" → Shared), and "Change who can see it" opens the edit dialog on the picker; the separate `share-resource` dialog named in the feature prompt was not drawn and is not built. Resolved.
- The role list offers the seven roles of `L2-061` AC1; Attendee and System Admin are not offered (System Admin can always open every resource). Resolved.
- `ResourceShared` emails are activity emails and are always sent; the announcement opt-out does not cover them. Resolved.
