import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CONTACTS_SERVICE, ContactStatus, ContactSummary } from '@faithtech-community/api';
import {
  AlertComponent,
  avatarColorFor,
  BadgeComponent,
  BadgeVariant,
  ButtonComponent,
  DialogService,
  EmptyStateComponent,
  formatDay,
  IconComponent,
  PageHeaderComponent,
  PersonCardComponent,
  PersonCardSkeletonComponent,
  PersonGridComponent,
  TextFieldComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { ArchiveContactDialog, ContactRef } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

const BADGES: Record<ContactStatus, { variant: BadgeVariant; label: string }> = {
  Private: { variant: 'neutral', label: 'Private' },
  SignedUp: { variant: 'success', label: 'Signed up' },
  Member: { variant: 'info', label: 'Member' },
};

/**
 * A lead's private contacts as a grid of person cards, with search (L2-012, L2-013, L2-060), matching
 * docs/mocks/pages/contacts.
 */
@Component({
  selector: 'ft-contacts-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    PersonCardComponent,
    PersonCardSkeletonComponent,
    PersonGridComponent,
    TextFieldComponent,
  ],
  templateUrl: './contacts.page.html',
  styleUrl: './contacts.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPage {
  private readonly contacts = inject(CONTACTS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly term = signal('');
  protected readonly state = signal<State>('loading');
  protected readonly list = signal<ContactSummary[]>([]);
  /** Browser-loadable photo URLs by contact id; a private photo is fetched with the token (ADR 0017). */
  protected readonly photos = signal<Partial<Record<string, string>>>({});

  protected readonly subtitle = computed(() => {
    const count = this.list().length;
    return this.term() || count === 0
      ? 'Private to you'
      : `Private to you · ${count} ${count === 1 ? 'contact' : 'contacts'}`;
  });
  /** The first contact who signed up and is not linked yet (L2-015). */
  protected readonly joined = computed(() => this.list().find((c) => c.status === 'SignedUp'));

  constructor() {
    void this.load();
  }

  protected badge(contact: ContactSummary) {
    return BADGES[contact.status];
  }

  protected meta(contact: ContactSummary): string {
    return [contact.organization, contact.city].filter(Boolean).join(' · ');
  }

  protected secondary(contact: ContactSummary): string {
    if (contact.noteCount > 0) {
      return `${contact.noteCount} ${contact.noteCount === 1 ? 'note' : 'notes'}`;
    }
    return `Added ${formatDay(new Date(contact.createdAtUtc))}`;
  }

  protected photoOf(contact: ContactSummary): string | null {
    return this.photos()[contact.id] ?? null;
  }

  protected color(contact: ContactSummary) {
    return avatarColorFor(contact.id);
  }

  /** The card's ×: confirms first, then removes the archived card (L2-061). */
  protected async archive(contact: ContactSummary): Promise<void> {
    const ref = this.dialogs.open<boolean, ContactRef>(ArchiveContactDialog, {
      data: { contactId: contact.id, name: contact.name },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.list.update((all) => all.filter((c) => c.id !== contact.id));
    this.toasts.show({
      variant: 'success',
      heading: 'Contact archived',
      text: `${contact.name} is in Archived contacts with your notes.`,
    });
  }

  protected search(): void {
    this.term.set(this.query.value.trim());
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.list.set(await firstValueFrom(this.contacts.list(this.term() || undefined)));
      this.state.set('loaded');
      this.loadPhotos();
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'error',
      );
    }
  }

  /** Each card shows its initials until its photo has loaded, and keeps them if it cannot. */
  private loadPhotos(): void {
    for (const contact of this.list()) {
      const url = contact.photoUrl;
      if (!url || this.photos()[contact.id]) continue;
      this.contacts.photoImage(url).subscribe({
        next: (src) => this.photos.update((all) => ({ ...all, [contact.id]: src })),
        error: () => undefined,
      });
    }
  }
}
