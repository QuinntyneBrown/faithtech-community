import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import {
  ContactDto,
  ContactNoteDto,
  ContactPhoto,
  CONTACTS_SERVICE,
  OrganisationNames,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BadgeComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  LinkComponent,
  NoteComponent,
  PageHeaderComponent,
  PhotoComponent,
  PhotoGalleryComponent,
  PhotoGalleryPhoto,
  SplitComponent,
  StackComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  AddContactPhotoData,
  AddContactPhotoDialog,
  AddNoteData,
  AddNoteDialog,
  ArchiveContactDialog,
  ContactRef,
  DeleteContactPhotoDialog,
  EditPhotoDescriptionDialog,
  LinkContactData,
  LinkContactDialog,
  PhotoRef,
} from '../../dialogs';

// A contact holds at most 10 photos (L2-068 AC2).
const MAX_PHOTOS = 10;

type State = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * One private contact, its photos and its private notes (L2-012 to L2-015, L2-068), matching
 * docs/mocks/pages/contact: a contact whose email a new member verified offers Link to their profile.
 * Photos are added, described and deleted through dialogs; featuring is immediate.
 */
@Component({
  selector: 'ft-contact-page',
  imports: [
    AlertComponent,
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    IconComponent,
    LinkComponent,
    NoteComponent,
    PageHeaderComponent,
    PhotoComponent,
    PhotoGalleryComponent,
    SplitComponent,
    StackComponent,
  ],
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly contacts = inject(CONTACTS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  /** Descriptions of photos chosen on the add-contact form that failed to upload (L2-067 AC6). */
  protected readonly failedPhotos = signal<string[]>(failedPhotosIn(inject(Location).getState()));
  /** The header photo as the browser can load it; a private photo is fetched with the token (ADR 0017). */
  protected readonly headerPhoto = signal<string | null>(null);
  protected readonly photos = signal<ContactPhoto[]>([]);
  /** Browser-loadable image URLs by photo id. */
  private readonly images = signal<Partial<Record<string, string>>>({});
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly full = computed(() => this.photos().length >= MAX_PHOTOS);
  protected readonly galleryPhotos = computed<PhotoGalleryPhoto[]>(() =>
    this.photos().map((p) => ({
      id: p.id,
      url: this.images()[p.id] ?? null,
      alt: p.altText,
      featured: p.isFeatured,
      storing: !p.isStored,
    })),
  );
  protected readonly firstName = computed(() => this.contact()?.name.split(/\s+/)[0] ?? '');

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly contact = signal<ContactDto | null>(null);
  protected readonly notes = signal<ContactNoteDto[]>([]);
  /** "Not them" hides the match on this visit only; nothing is stored (ADR 0014). */
  protected readonly dismissed = signal(false);
  protected readonly justLinked = signal(false);
  protected readonly match = computed(() => (this.dismissed() ? null : this.contact()?.match));

  protected readonly subtitle = computed(() => {
    const contact = this.contact();
    if (!contact) return '';
    if (contact.linkedProfileId) return 'Member · linked profile';
    return contact.isOwn
      ? 'Private contact · only you can see this'
      : 'Another lead’s private contact · your access is recorded';
  });

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected day(value: string): string {
    return formatDay(value);
  }

  protected added(contact: ContactDto): string {
    return `${formatDay(contact.createdAtUtc)}${contact.isOwn ? ' by you' : ''}`;
  }

  protected async addNote(contact: ContactDto): Promise<void> {
    const ref = this.dialogs.open<ContactNoteDto, AddNoteData>(AddNoteDialog, {
      data: { contactId: contact.id, contactName: contact.name },
    });
    const note = await firstValueFrom(ref.closed);
    if (note) this.notes.update((notes) => [note, ...notes]);
  }

  protected async link(contact: ContactDto): Promise<void> {
    if (!contact.match) return;
    const ref = this.dialogs.open<ContactDto, LinkContactData>(LinkContactDialog, {
      data: {
        contactId: contact.id,
        email: contact.email,
        noteCount: contact.noteCount,
        member: contact.match,
      },
    });
    const linked = await firstValueFrom(ref.closed);
    if (!linked) return;
    this.show(linked);
    this.justLinked.set(true);
    this.notes.set(await firstValueFrom(this.contacts.getNotes(contact.id)));
  }

  protected dismiss(): void {
    this.dismissed.set(true);
  }

  protected async archive(contact: ContactDto): Promise<void> {
    const ref = this.dialogs.open<boolean, ContactRef>(ArchiveContactDialog, {
      data: { contactId: contact.id, name: contact.name },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({
      variant: 'success',
      heading: 'Contact archived',
      text: `${contact.name} is in Archived contacts with your notes.`,
    });
    await this.router.navigateByUrl('/contacts');
  }

  protected async addPhotos(contact: ContactDto): Promise<void> {
    const ref = this.dialogs.open<ContactPhoto[], AddContactPhotoData>(AddContactPhotoDialog, {
      data: {
        contactId: contact.id,
        contactName: contact.name,
        room: MAX_PHOTOS - this.photos().length,
      },
    });
    const added = await firstValueFrom(ref.closed);
    if (!added?.length) return;
    const first = this.photos().length === 0;
    this.setPhotos([...added].reverse().concat(this.photos()));
    if (first) await this.refresh(contact.id);
    this.toasts.show({
      variant: 'success',
      heading: added.length === 1 ? 'Photo added' : 'Photos added',
      text: `Only you can see ${added.length === 1 ? 'it' : 'them'}.`,
    });
  }

  protected async featurePhoto(contact: ContactDto, index: number): Promise<void> {
    const photo = this.photos()[index];
    try {
      await firstValueFrom(this.contacts.setFeaturedPhoto(contact.id, photo.id));
    } catch {
      this.toasts.show({ variant: 'danger', heading: 'Photo not featured', text: 'Try again.' });
      return;
    }
    this.photos.update((list) => list.map((p) => ({ ...p, isFeatured: p.id === photo.id })));
    if (!contact.linkedProfileId) {
      this.contact.update((c) => c && { ...c, photoAltText: photo.altText });
      this.headerPhoto.set(this.images()[photo.id] ?? null);
    }
  }

  protected async describePhoto(contact: ContactDto, index: number): Promise<void> {
    const photo = this.photos()[index];
    const ref = this.dialogs.open<string, PhotoRef>(EditPhotoDescriptionDialog, {
      data: this.photoRef(contact, photo),
    });
    const altText = await firstValueFrom(ref.closed);
    if (!altText) return;
    this.photos.update((list) => list.map((p) => (p.id === photo.id ? { ...p, altText } : p)));
    this.toasts.show({ variant: 'success', heading: 'Description saved', text: altText });
  }

  protected async deletePhoto(contact: ContactDto, index: number): Promise<void> {
    const photo = this.photos()[index];
    const ref = this.dialogs.open<boolean, PhotoRef>(DeleteContactPhotoDialog, {
      data: this.photoRef(contact, photo),
    });
    if (!(await firstValueFrom(ref.closed))) return;
    // The server picks the next featured photo, so read the photos again.
    await this.refresh(contact.id);
    this.toasts.show({ variant: 'success', heading: 'Photo deleted', text: photo.altText });
  }

  protected retry(): void {
    void this.load(this.id());
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const [contact, notes] = await Promise.all([
        firstValueFrom(this.contacts.get(id)),
        firstValueFrom(this.contacts.getNotes(id)),
      ]);
      this.show(contact);
      this.notes.set(notes);
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }

  private photoRef(contact: ContactDto, photo: ContactPhoto): PhotoRef {
    return {
      contactId: contact.id,
      contactName: contact.name,
      photo: {
        id: photo.id,
        url: this.images()[photo.id] ?? null,
        altText: photo.altText,
        featured: photo.isFeatured,
      },
    };
  }

  private async refresh(id: string): Promise<void> {
    try {
      this.show(await firstValueFrom(this.contacts.get(id)));
    } catch {
      // The page keeps what it shows; the next visit loads it again.
    }
  }

  private show(contact: ContactDto): void {
    this.contact.set(contact);
    this.setPhotos(contact.photos ?? []);
    this.loadHeaderPhoto(contact);
  }

  /** Each photo shows a placeholder until its image has loaded with the lead's credentials (ADR 0017). */
  private setPhotos(photos: ContactPhoto[]): void {
    this.photos.set(photos);
    for (const photo of photos) {
      if (!photo.url || this.images()[photo.id]) continue;
      this.contacts.photoImage(photo.url).subscribe({
        next: (src) => this.images.update((all) => ({ ...all, [photo.id]: src })),
        error: () => undefined,
      });
    }
  }

  private loadHeaderPhoto(contact: ContactDto): void {
    this.headerPhoto.set(null);
    if (!contact.photoUrl) return;
    this.contacts.photoImage(contact.photoUrl).subscribe({
      next: (src) => this.headerPhoto.set(src),
      error: () => undefined,
    });
  }
}

function failedPhotosIn(state: unknown): string[] {
  const failed = (state as { failedPhotos?: unknown } | null)?.failedPhotos;
  return Array.isArray(failed) ? failed.filter((f): f is string => typeof f === 'string') : [];
}
