# View a profile

## Overview

A *profile* is the public face of an account inside the community: a name, up to ten photos with one featured, and the roles the person holds. Profiles exist so that members can recognise each other across events, teams and partners.

**featured photo** — the single photo shown as a profile's avatar

**member** — any signed-in user, whatever roles the profile holds

Profiles are visible to signed-in members only. An anonymous visitor who requests a profile page is redirected to sign in, and the profile API returns 401. A private contact is not a profile: until a contact is linked to a real account, any request for it as a profile returns 404 to everyone except its owner and System Admin.

## Description

- **`ProfilePage`** — page in the `profiles` feature library, matching the `profile` mock. It shows the name, featured photo, photo gallery and role badges using `components` avatars, badges and cards.
- **`authGuard`** — app-shell route guard that redirects anonymous visitors to sign in before the `profiles` library loads.
- **`ProfilesService`** — contract in the `api` library, provided through the `PROFILES_SERVICE` injection token and implemented by `HttpProfilesService`.
- **`ProfilesEndpoints`** — minimal API route group in `FaithTech.Community.Api` under `/api/profiles`. Its endpoints require authentication by default and hold no business logic.
- **`ICurrentUser`** — Application abstraction exposing the caller's user id, profile id and roles.
- **`Profile`** — Domain entity holding `Name`, `Roles` and the `Photos` collection.
- **`GetProfileQuery`** / **`GetProfileHandler`** — Application request and handler. The handler loads the profile with photos and roles and returns a `ProfileDto`. It returns not-found for an unlinked private contact unless the caller owns it or is System Admin.
- **`ProfileDto`** — response contract: `Id`, `Name`, `FeaturedPhoto`, `Photos` (URL and alt text) and `Roles`.
- **Photo URLs** — photos are served from Azure Blob Storage. The access form (public container, SAS URL or API proxy) is `<TO SUPPLY>`.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-005` | `L1-002` | Profile visibility |

### Acceptance criteria

**`L2-005`**

1. Given an anonymous visitor, when they request any profile page or profile API, then they are redirected to sign in (page) or receive 401 (API).
2. Given a signed-in member, when they open another member's profile, then they see the name, featured photo, photos and roles.
3. Given a private contact that has not been linked, when any user other than its owner or a System Admin requests it as a profile, then the response is 404.

## Diagrams

### System context

Members view profiles in FaithTech Community. Anonymous visitors are refused.

![C4 system context for viewing a profile](diagrams/c4-context.png)

### Containers

The web app requests a profile from the Community API, which reads it from the Community database. Photo images come from Photo storage.

![C4 container view for viewing a profile](diagrams/c4-container.png)

### Components

`ProfilesEndpoints` requires authentication and forwards a `GetProfileQuery` to `GetProfileHandler`, which applies the private-contact rule before reading.

![C4 component view for viewing a profile](diagrams/c4-component.png)

### Class structure

`GetProfileHandler` reads `Profile` with its `ProfilePhoto` collection and `Role` set, and maps it to `ProfileDto`.

![Class diagram for viewing a profile](diagrams/class-structure.png)

### Behaviour — view a profile

The guard and the endpoint refuse anonymous callers. The handler hides unlinked private contacts behind a 404 and returns the name, photos and roles to every other member (`L2-005`).

![Sequence diagram for view a profile](diagrams/sequence-view-profile.png)
