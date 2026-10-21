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
import { Router } from '@angular/router';
import { CONTACTS_SERVICE, ContactDto, ContactNoteDto } from '@faithtech-community/api';
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
  SplitComponent,
  StackComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  AddNoteData,
  AddNoteDialog,
  ArchiveContactDialog,
  ContactRef,
  LinkContactData,
  LinkContactDialog,
} from '../../dialogs';

type State = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * One private contact and its private notes (L2-012 to L2-015), matching docs/mocks/pages/contact:
 * a contact whose email a new member verified offers Link to their profile.
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
    SplitComponent,
    StackComponent,
  ],
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPage {
  private readonly contacts = inject(CONTACTS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly contact = signal<ContactDto | null>(null);
  protected readonly notes = signal<ContactNoteDto[]>([]);
  /** "Not them" hides the match on this visit only; nothing is stored (ADR 0010). */
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
    this.contact.set(linked);
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
      this.contact.set(contact);
      this.notes.set(notes);
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }
}
