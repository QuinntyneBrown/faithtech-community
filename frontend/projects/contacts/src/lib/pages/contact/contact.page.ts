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
import { CONTACTS_SERVICE, ContactDto, ContactNoteDto } from '@faithtech-community/api';
import {
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
  SkeletonComponent,
  SplitComponent,
  StackComponent,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { AddNoteDialog, AddNoteData } from '../../dialogs';

type State = 'loading' | 'loaded' | 'not-found' | 'error';

/** One private contact and its private notes (L2-012 to L2-014), matching docs/mocks/pages/contact. */
@Component({
  selector: 'ft-contact-page',
  imports: [
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
    SkeletonComponent,
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

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly contact = signal<ContactDto | null>(null);
  protected readonly notes = signal<ContactNoteDto[]>([]);

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

  protected async addNote(contact: ContactDto): Promise<void> {
    const ref = this.dialogs.open<ContactNoteDto, AddNoteData>(AddNoteDialog, {
      data: { contactId: contact.id, contactName: contact.name },
    });
    const note = await firstValueFrom(ref.closed);
    if (note) this.notes.update((notes) => [note, ...notes]);
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
