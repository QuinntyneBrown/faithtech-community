import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CONTACTS_SERVICE, ContactStatus, ContactSummary } from '@faithtech-community/api';
import {
  AlertComponent,
  AvatarComponent,
  BadgeComponent,
  BadgeVariant,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

const BADGES: Record<ContactStatus, { variant: BadgeVariant; label: string }> = {
  Private: { variant: 'neutral', label: 'Private' },
  SignedUp: { variant: 'success', label: 'Signed up' },
  Member: { variant: 'info', label: 'Member' },
};

/** A lead's private contacts with search (L2-012, L2-013), matching docs/mocks/pages/contacts. */
@Component({
  selector: 'ft-contacts-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    TextFieldComponent,
  ],
  templateUrl: './contacts.page.html',
  styleUrl: './contacts.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPage {
  private readonly contacts = inject(CONTACTS_SERVICE);

  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly term = signal('');
  protected readonly state = signal<State>('loading');
  protected readonly list = signal<ContactSummary[]>([]);

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
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'error',
      );
    }
  }
}
