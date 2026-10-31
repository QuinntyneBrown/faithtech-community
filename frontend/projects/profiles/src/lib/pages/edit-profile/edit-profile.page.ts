import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  OrganisationNames,
  PhotoDto,
  ProfileDto,
  PROFILES_SERVICE,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  ErrorSummaryComponent,
  FormActionsComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  PageHeaderComponent,
  PhotoState,
  PictureListComponent,
  PictureListPhoto,
  SkeletonComponent,
  StackComponent,
  TextareaComponent,
  TextFieldComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { DeletePhotoData, DeletePhotoDialog } from '../../dialogs';

type Field = 'name' | 'homeCity' | 'bio';
type State = 'loading' | 'loaded' | 'error' | 'forbidden';

/** A photo on the page: saved (it has an id) or pending (chosen, uploaded on save). */
interface PhotoItem {
  id: string | null;
  file: File | null;
  url: string | null;
  alt: string;
  savedAlt: string;
  featured: boolean;
  uploadedAt: string;
  state?: PhotoState;
  error?: string;
  storing?: boolean;
}

const FIELDS: Field[] = ['name', 'homeCity', 'bio'];
// The server's validators are the authority; these mirror them.
const MAX: Record<Field, number> = { name: 100, homeCity: 100, bio: 400 };
const TOO_LONG: Record<Field, string> = {
  name: 'Use 100 characters or fewer for your name.',
  homeCity: 'Use 100 characters or fewer for your home city.',
  bio: 'Use 400 characters or fewer for your bio.',
};
const MAX_ALT = 300;
const MISSING_ALT = 'Describe what’s in the photo for people using screen readers.';
const LONG_ALT = 'Use 300 characters or fewer to describe this photo.';

/**
 * Edit your own name, home city, bio and photos (L2-006, L2-007), matching
 * docs/mocks/pages/edit-profile. Feature acts at once; Remove confirms first; new photos and
 * changed descriptions are saved with Save profile. A System Admin edits another member's
 * profile here too, at /people/{id}/edit (L2-040, edit-profile/admin); anyone else sees the
 * forbidden state, and the API refuses the change regardless (ADR 0004).
 */
@Component({
  selector: 'ft-edit-profile-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormActionsComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    PageHeaderComponent,
    PictureListComponent,
    SkeletonComponent,
    StackComponent,
    TextareaComponent,
    TextFieldComponent,
  ],
  templateUrl: './edit-profile.page.html',
  styleUrl: './edit-profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfilePage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly profiles = inject(PROFILES_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);
  private readonly pictureList = viewChild(PictureListComponent);
  private readonly nameField = viewChild('nameField', { read: FormFieldComponent });
  private readonly homeCityField = viewChild('homeCityField', { read: FormFieldComponent });
  private readonly bioField = viewChild('bioField', { read: FormFieldComponent });

  /** Route parameter: the profile to edit. me/edit has none, so the router binds undefined: "me". */
  readonly id = input('me', { transform: (id: string | undefined) => id ?? 'me' });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [''],
    homeCity: [''],
    bio: [''],
  });
  protected readonly state = signal<State>('loading');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly photosFailed = signal(false);
  protected readonly photos = signal<PhotoItem[]>([]);
  protected readonly profile = signal<ProfileDto | null>(null);
  /** A System Admin editing someone else's profile (L2-040 AC3). */
  protected readonly other = computed(() => this.profile()?.isOwn === false);
  protected readonly title = computed(() => {
    const profile = this.profile();
    return profile && this.other() ? `Edit ${profile.name}’s profile` : 'Edit profile';
  });
  protected readonly profileHref = computed(() =>
    this.id() === 'me' || this.profile()?.isOwn ? '/people/me' : `/people/${this.id()}`,
  );
  protected readonly aboutHeading = computed(() =>
    this.other() ? `About ${this.profile()!.name.split(' ')[0]}` : 'About you',
  );
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  // Re-evaluated on submit; the form's own state is not a signal.
  private readonly version = signal(0);

  protected readonly errors = computed(() => {
    this.version();
    const server = this.serverErrors();
    return FIELDS.map((field) => ({
      field,
      message: server[field] ?? this.clientError(field),
    })).filter((e) => e.message !== '');
  });

  protected readonly altErrors = computed(() =>
    this.photos().map((p) => {
      if (!this.submitted()) return '';
      const alt = p.alt.trim();
      return alt === '' ? MISSING_ALT : alt.length > MAX_ALT ? LONG_ALT : '';
    }),
  );

  protected readonly listPhotos = computed<PictureListPhoto[]>(() =>
    this.photos().map((p, i) => ({
      id: p.id,
      url: p.url,
      storing: p.storing,
      alt: p.alt,
      featured: p.featured,
      pending: p.id === null && p.state === undefined,
      state: p.state,
      error: p.error,
      altError: this.altErrors()[i],
    })),
  );

  protected readonly summary = computed<FormError[]>(() => [
    ...this.errors().map((e) => ({ message: e.message, fieldId: this.fieldOf(e.field) })),
    ...this.altErrors().flatMap((error, i) =>
      error
        ? [
            {
              message: error === MISSING_ALT ? 'Describe this photo' : error,
              fieldId: this.pictureList()?.descriptionFieldId(i) ?? '',
            },
          ]
        : [],
    ),
  ]);

  constructor() {
    effect(() => {
      this.id();
      untracked(() => void this.load());
    });
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected load(): Promise<void> {
    this.state.set('loading');
    return firstValueFrom(this.profiles.getProfile(this.id())).then(
      (profile) => {
        this.profile.set(profile);
        if (!profile.canEdit) {
          this.state.set('forbidden');
          return;
        }
        this.form.setValue({
          name: profile.name,
          homeCity: profile.homeCity ?? '',
          bio: profile.bio ?? '',
        });
        this.photos.set(profile.photos.map(savedPhoto));
        this.state.set('loaded');
      },
      () => this.state.set('error'),
    );
  }

  protected pick(files: File[]): void {
    const added = files.map<PhotoItem>((file) => ({
      id: null,
      file,
      url: previewUrl(file),
      alt: '',
      savedAlt: '',
      featured: false,
      uploadedAt: '',
    }));
    this.photos.update((list) => [...list, ...added]);
  }

  protected describe({ index, alt }: { index: number; alt: string }): void {
    this.photos.update((list) => list.map((p, i) => (i === index ? { ...p, alt } : p)));
  }

  protected async feature(index: number): Promise<void> {
    const photo = this.photos()[index];
    const profile = this.profile();
    if (!photo?.id || !profile) return;
    try {
      await firstValueFrom(this.profiles.setFeatured(profile.id, photo.id));
      this.photos.update((list) => list.map((p) => ({ ...p, featured: p.id === photo.id })));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t feature that photo',
        text: 'Nothing was changed — try again.',
      });
    }
  }

  protected remove(index: number): void {
    const photo = this.photos()[index];
    const profile = this.profile();
    if (!photo || !profile) return;
    if (!photo.id) {
      // Nothing is stored yet, so there is nothing to confirm.
      revokePreview(photo.url);
      this.photos.update((list) => list.filter((p) => p !== photo));
      return;
    }
    const data: DeletePhotoData = {
      profileId: profile.id,
      photo: { id: photo.id, url: photo.url, altText: photo.savedAlt },
    };
    const ref = this.dialogs.open<boolean, DeletePhotoData>(DeletePhotoDialog, {
      data,
    });
    ref.closed.subscribe((deleted) => {
      if (deleted) this.photos.update((list) => withoutPhoto(list, photo));
    });
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.failed.set(false);
    this.photosFailed.set(false);
    this.version.update((v) => v + 1);
    const profile = this.profile();
    if (this.errors().length || this.altErrors().some(Boolean) || this.busy() || !profile) {
      return;
    }

    this.busy.set(true);
    try {
      await firstValueFrom(this.profiles.updateProfile(profile.id, this.form.getRawValue()));
    } catch (error) {
      const fieldErrors = validationErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.failed.set(true);
      this.busy.set(false);
      this.errorFocus()?.focusFirstError();
      return;
    }

    const photosSaved = await this.savePhotos(profile.id);
    this.busy.set(false);
    if (photosSaved) {
      this.toasts.show({
        variant: 'success',
        heading: 'Profile saved',
        text: this.other()
          ? 'Everyone signed in can now see the changes.'
          : 'Everyone signed in can now see your changes.',
      });
    } else {
      this.photosFailed.set(true);
    }
  }

  /** Saves changed descriptions, then uploads pending photos one at a time. True when all saved. */
  private async savePhotos(profileId: string): Promise<boolean> {
    let ok = true;
    for (const photo of this.photos()) {
      const alt = photo.alt.trim();
      if (!photo.id || alt === photo.savedAlt) continue;
      try {
        await firstValueFrom(this.profiles.describePhoto(profileId, photo.id, alt));
        this.replace(photo, { ...photo, alt, savedAlt: alt, error: undefined });
      } catch (error) {
        ok = false;
        this.replace(photo, {
          ...photo,
          error: photoError(error, 'We couldn’t save this description. Try again.'),
        });
      }
    }
    for (const photo of this.photos()) {
      if (photo.id || !photo.file) continue;
      const uploading = { ...photo, state: 'uploading' as const, error: undefined };
      this.replace(photo, uploading);
      try {
        const saved = await firstValueFrom(
          this.profiles.uploadPhoto(profileId, photo.file, photo.alt.trim()),
        );
        revokePreview(photo.url);
        this.replace(uploading, savedPhoto(saved));
      } catch (error) {
        ok = false;
        this.replace(uploading, {
          ...photo,
          state: 'failed',
          error: photoError(error, 'Upload failed. Try again.'),
        });
      }
    }
    return ok;
  }

  private replace(photo: PhotoItem, next: PhotoItem): void {
    this.photos.update((list) => list.map((p) => (p === photo ? next : p)));
  }

  private clientError(field: Field): string {
    if (!this.submitted()) return '';
    const value = this.form.controls[field].value.trim();
    if (field === 'name' && value === '') return 'Enter your name as you’d like people to see it.';
    return value.length > MAX[field] ? TOO_LONG[field] : '';
  }

  private fieldOf(field: Field): string {
    const formField = { name: this.nameField, homeCity: this.homeCityField, bio: this.bioField }[
      field
    ]();
    return formField?.controlId() ?? '';
  }
}

function savedPhoto(photo: PhotoDto): PhotoItem {
  return {
    id: photo.id,
    file: null,
    url: photo.url,
    alt: photo.altText,
    savedAlt: photo.altText,
    featured: photo.isFeatured,
    uploadedAt: photo.uploadedAt,
    storing: !photo.isStored,
  };
}

/** Removes a deleted photo; as on the server, the newest remaining photo takes over as featured. */
function withoutPhoto(list: PhotoItem[], removed: PhotoItem): PhotoItem[] {
  const rest = list.filter((p) => p !== removed);
  if (!removed.featured) return rest;
  const newest = rest
    .filter((p) => p.id)
    .reduce<PhotoItem | null>((a, p) => (!a || p.uploadedAt > a.uploadedAt ? p : a), null);
  return rest.map((p) => (p === newest ? { ...p, featured: true } : p));
}

function previewUrl(file: File): string {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
}

function revokePreview(url: string | null): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

/** The first message of a 400 from the photo endpoints, or the fallback. */
function photoError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
    const first = Object.values(errors).flat()[0];
    if (first) return first;
  }
  return fallback;
}

/** Maps the API's validation problem details (PascalCase keys) onto the form's fields. */
function validationErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = FIELDS.find((f) => f.toLowerCase() === key.toLowerCase());
    if (field && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
