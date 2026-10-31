# Responsive layout and theming

## Overview

The Community platform runs on phones and desktops and in light and dark themes. This design describes the shared layout grid, breakpoints and theme switching that the app shell and the `components` library provide.

- **breakpoint** — named viewport width threshold, from the design system tokens (`--layout-breakpoint-*`) that `BreakpointService` implements: XS <640px, SM >=640px, MD >=768px, LG >=1024px, XL >=1280px
- **theme** — set of colour token values; light and dark themes define the same role names
- **theme preference** — member choice of `system`, `light` or `dark`; `system` follows `prefers-color-scheme`

## Description

- **Layout tokens** — breakpoint, gutter, margin and spacing custom properties in `components` (from `docs/design-system/`).
- **`AppShellComponent`** — shell in the `faithtech-community` app. Under 768px the tab bar's More opens `NavDrawerComponent` from `components`; from 768px to 1535px `TopBarComponent`'s More (`moreLabel`, `more`) opens the same drawer while the secondary links are hidden; from 1536px (`--layout-breakpoint-2xl`) the top bar shows every section. The top bar shows the organisation's short name from `/api/me` as the product name, and the page titles use the organisation name (`L2-133` AC2, `L2-134`).
- **Content container** — `AppShellComponent` wraps the routed page in `ContainerComponent` inside `<main>`, as the mocks' `<main class="container">`: at most `--layout-container-max` (80rem) wide, centred, padded by `--layout-margin` (16px, 32px from 768px, 48px from 1024px). Pages never add their own page gutters; auth, public and error pages sit outside the shell and keep their own layouts.
- **Navigation by capability** — `shell/navigation.ts` in the app holds the ordered sections and the capabilities that may open each, read from `capabilities` on `/api/me` (`L2-133` AC1), never from role names (`L2-135` AC7): Home, Events, Team, Announcements, Resources and Notes for everyone; Contacts for `KeepContacts`; Partners for `ViewPartners`; Workspaces for `OwnWorkspaces`, `JoinWorkspaces` or `ReadAllWorkspaces`; People for `ViewPeopleDirectory`; Reports for `ViewReports`; **Organisation** for `ManageRoles` or `ManageOrganisationSettings`, a secondary section placed before Admin (`L2-147` AC1); Admin for `AdministerOrganisation`. `sectionsFor(capabilities)` feeds the top bar and the menu, `tabsFor(capabilities)` the phone tab bar's links, followed by `TabBarComponent`'s More button that opens `NavDrawerComponent` and is current (`aria-current="true"`) when no link tab is (ADR 0009, refined by ADR 0033). The API still enforces every permission. The secondary item **Notes** (`/notes`, `notes` icon) opens for every signed-in member and sits after Resources; it lazy-loads the `notes` library (`L2-085`, `notes/pages-and-list`).
- **Account menu** — opened from the avatar in the top bar at any width: "Your profile", "Settings", "Switch organisation" when `/api/me` lists more than one membership (a list of the other organisations by name, each linking to its host, `L2-133` AC3) and "Sign out" (`L2-003` AC9).
- **`BreakpointService`** — `components` wrapper over CDK `BreakpointObserver` exposing the current named breakpoint as a signal.
- **`ThemeService`** — `components` service that applies `data-theme="light|dark"` on `<html>`. With preference `system` it follows `matchMedia('(prefers-color-scheme: dark)')`.
- **Appearance setting** — the settings page (`SettingsPage` in the `notifications` library, mock `pages/settings`) has an *Appearance* card: a `CardComponent` holding a `RadioGroupComponent` with *Light*, *Dark* and *Match my device* (`light`, `dark`, `system`). Choosing one calls `ThemeService.set()` at once; it is not part of the account form's *Save settings*.
- **Theme preference storage** — browser storage only (`localStorage` key `ft-theme`, read by `ThemeService` on start; the app creates `ThemeService` in an app initializer, so the saved theme applies on whatever page loads first, not only on Settings), so the choice is per device and needs no API. Decided here as the simplest option that fits the existing `ThemeService`; a per-profile preference can follow if members ask for it.
- **Control sizes** — `TextFieldComponent` takes `size` `sm` (36px), `md` (44px, default) or `lg` (52px) from the `--control-height-*` tokens, as `ButtonComponent` does. `TopBarComponent` composes the small field for its search (an `inputId` keeps its visually hidden `<label for>`), `PictureListComponent` the small field for photo descriptions, and the Search page takes the large one.
- **Toasts clear the tab bar** — `TabBarComponent` registers with `TabBarPresence` (in `components`) while it is rendered; `ToastRegionComponent` reads it and, below 768px, sits 16px above the tab bar and its safe area. Without a tab bar (auth and public pages) the region keeps its 16px margin; from 640px it is 24rem wide, 24px from the bottom-right corner.
- **Touch targets** — interactive components set a minimum of 24x24 CSS pixels through a size token.
- **Playwright viewport projects** — the e2e suite runs layout specs at one width per breakpoint in Chromium and asserts no horizontal page scroll.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-045` | `L1-016` | Responsive layout and theming |
| `L2-133` | `L1-025` | Organisation switcher and `/api/me` |

### Acceptance criteria

**`L2-045` — Responsive layout and theming**

1. Given any screen at XS, SM, MD, LG and XL widths, when it renders, then there is no horizontal page scroll, and touch targets are at least 24x24 CSS pixels.
2. Given an XS viewport, when the app shell renders, then the navigation collapses into a menu.
3. Given the operating system prefers a dark theme, when the app loads, then the dark theme is used.
4. Given a signed-in member, when the app shell renders, then the top bar, the phone tab bar and the menu list only the sections the member's capabilities (`/api/me`, `L2-133` AC2) may open, from one rule: Home, Events, Team, Announcements, Resources and Notes for everyone; Contacts for `KeepContacts`; Partners for `ViewPartners`; Workspaces for `OwnWorkspaces`, `JoinWorkspaces` or `ReadAllWorkspaces`; People for `ViewPeopleDirectory`; Reports for `ViewReports` (`L2-123`); Organisation for `ManageRoles` or `ManageOrganisationSettings` (`L2-147` AC1); Admin for `AdministerOrganisation`. The tab bar is Home, Events, Search, the member's next section and More, which opens the menu of every section and is the current tab whenever the page is outside the other four.
5. Given a viewport from MD up to 1535px, when the app shell renders, then the secondary sections (Team, Announcements, Resources, People, Reports, Organisation, Admin) are hidden from the top bar and a "More" button at the end of the top-bar nav opens the menu of every section, so no section is reachable only from Home; from 2XL (1536px, `--layout-breakpoint-2xl`) the secondary links join the top bar and More hides.
6. Given a signed-in member on Settings, when they choose Light, Dark or "Match my device" under Appearance, then the theme changes at once without saving the form, the choice is remembered on this device (browser storage), and "Match my device" returns to following the operating system.

**`L2-133` — Organisation switcher and `/api/me`**

1. Given a signed-in member, when the app loads or restores a session, then `GET /api/me` returns the organisation (name, short name, chapter label singular and plural or none), the profile, the roles held (role id, name, chapter if tagged), the capabilities held, the home chapter, and the account's other memberships (organisation name and host).
2. Given the response, when the shell renders, then the top bar shows the organisation's short name as the product name, the page titles use the organisation name (`L2-134`), and the navigation is built from the capabilities (`L2-045` AC4).
3. Given an account with more than one membership, when the account menu opens (`L2-003` AC9), then it offers "Switch organisation" listing the other organisations by name; choosing one opens that organisation's host, where the kept session signs the member in without re-entering credentials (ADR 0018's same-site model does not apply across hosts, so a session that is not kept asks for sign-in).
4. Given an account with one membership, when the account menu opens, then there is no "Switch organisation" entry.
5. Given a role, a definition or a chapter changes, when the member's next request runs, then the server authorises with the new capabilities (`L2-042` AC4), and `/api/me` reports them; the app reloads `/api/me` when a `403` arrives for an action the shell believed allowed.

## Diagrams

### System context

A member uses the Community platform on any device width and theme.

![C4 system context for responsive layout and theming](diagrams/c4-context.png)

### Containers

Layout and theming live entirely in the web app; the navigation rule reads the capabilities and organisation that `/api/me` returns.

![C4 container view for responsive layout and theming](diagrams/c4-container.png)

### Components

`AppShellComponent` observes `BreakpointService` to collapse navigation at XS, builds the sections from the capabilities in `/api/me`, and initializes `ThemeService`, which selects light or dark token values.

![C4 component view for responsive layout and theming](diagrams/c4-component.png)

### Class structure

`ThemeService` resolves a `ThemePreference` to an effective theme; `BreakpointService` exposes the current `Breakpoint`; `navigation.ts` keys each `Section` on capabilities.

![Class diagram for responsive layout and theming](diagrams/class-structure.png)

### Behaviour — load the app shell

On load the shell picks the theme from the stored preference or the operating system, reads the organisation and capabilities from `/api/me`, and collapses navigation at XS (`L2-045`).

![Sequence diagram for load the app shell](diagrams/sequence-load-shell.png)

## Open questions

- Capabilities: the navigation rule is keyed on capabilities from `/api/me` instead of role names, gains the Organisation section, and the top bar shows the organisation's short name (ADR 0032, ADR 0033).
