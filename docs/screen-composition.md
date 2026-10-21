# Screen composition

Which `@faithtech-community/components` parts build each screen, and what is built locally in the feature library. Sources: the mocks in `docs/mocks/` (states listed per screen) and the public API of `frontend/projects/components/src/public-api.ts`. Mock-only chrome (`mock-bar`, `mock-note`) is excluded.

**Local UI** is markup a feature library writes itself. It is limited to page composition: headings that belong to the page, sections and the glue between `api` services and components. Anything reusable goes into `components` first (`AGENTS.md`).

Coverage: the profiles screens (`profile`, `edit-profile`, `delete-photo`). Other screens are added here as their features are built.

## Shell

| Part | Library | Local |
|---|---|---|
| App shell around `/people/**` | `TopBarComponent` with an `AvatarComponent` link "Your profile, {name}" to `/people/me`, `NavDrawerComponent`, `TabBarComponent`, `SkipLinkComponent`, `ToastRegionComponent` (in `AppShellComponent`) | — |

## Pages

### Profile — `/people/:id`, `/people/me` (`pages/profile`: default, own, loading, empty, error, not-found)

- Library: `ProfileHeaderComponent` (featured photo via `StickerComponent` or initials via `AvatarComponent`, name as the `h1`, `BadgeComponent` roles, home city, bio, photo strip of `PhotoComponent`), `ButtonComponent` (*Edit profile*, *Add photos*, *Try again*, *Go home*), `EmptyStateComponent` (no photos on the own profile; error variant for load failure; not-found).
- Loading uses `ProfileHeaderComponent [loading]` (skeletons, `aria-busy`).
- Own state adds *Edit profile* in the header's `[actions]` slot.
- Local: none beyond composition. The `h1` for the error and not-found states is a visually hidden page heading.

### Edit profile — `/people/me/edit` (`pages/edit-profile`: default, loading, error, invalid, busy, success, uploading, too-large, pending, full)

- Library: `BreadcrumbComponent` + `BreadcrumbItemComponent`, `PageHeaderComponent`, `CardComponent` (About you, Photos), `StackComponent`, `FormFieldComponent` + `TextFieldComponent` (Name, Home city), `FormFieldComponent` + `TextareaComponent` (Bio), `PictureListComponent` (photos, descriptions, Feature, Remove, Add photos, uploading, failed, pending and full states), `ErrorSummaryComponent` (invalid), `FormActionsComponent` + `ButtonComponent` (*Save profile* with `loading`, *Cancel*), `SkeletonComponent` (loading), `EmptyStateComponent` error variant (error), `ToastService` (success: "Profile saved").
- Opens `DeletePhotoDialog` through `DialogService` from a saved photo's Remove.
- Local: the `<form>` element and the section headings.

## Dialogs

| Dialog (mock: states) | Surface | Library | Local |
|---|---|---|---|
| Delete photo (`dialogs/delete-photo`: default, busy, failed) | `DialogService` (CDK Dialog) | `DialogComponent` (`tone="danger"`, `icon="delete"`, `busy`), `PhotoComponent` (the photo being deleted), `AlertComponent` (failed), `ButtonComponent` (*Cancel*, *Delete photo* `variant="danger"` with `loading`) | — |

## Notifications

None for profiles.

## Summary of local UI to build

1. Nothing reusable: every profiles screen is composed from the library. `PictureListComponent` gained a per-photo `pending` flag for photos chosen but not saved yet (design system: `components/picture-list.html`).
