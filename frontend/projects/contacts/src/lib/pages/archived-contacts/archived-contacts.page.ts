import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CONTACTS_SERVICE, ContactSummary } from '@faithtech-community/api';
import {
  AvatarComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { ContactRef, DeleteContactDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

/** The lead's archived contacts with Restore and Delete permanently (L2-016), matching docs/mocks/pages/archived-contacts. */
@Component({
  selector: 'ft-archived-contacts-page',
  imports: [
    AvatarComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    ClusterComponent,
    EmptyStateComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
  ],
  templateUrl: './archived-contacts.page.html',
  styleUrl: './archived-contacts.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivedContactsPage {
  private readonly contacts = inject(CONTACTS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<State>('loading');
  protected readonly list = signal<ContactSummary[]>([]);
  protected readonly restoring = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected meta(contact: ContactSummary): string {
    const archived = contact.archivedAtUtc ? `Archived ${formatDay(contact.archivedAtUtc)}` : '';
    return [archived, contact.city].filter(Boolean).join(' · ');
  }

  protected retry(): void {
    void this.load();
  }

  protected async restore(contact: ContactSummary): Promise<void> {
    if (this.restoring()) return;
    this.restoring.set(contact.id);
    try {
      await firstValueFrom(this.contacts.restore(contact.id));
      this.remove(contact);
      this.toasts.show({
        variant: 'info',
        heading: 'Contact restored',
        text: `${contact.name} is back in your contacts.`,
      });
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'That didn’t work',
        text: `We couldn’t restore ${contact.name}. Try again.`,
      });
    } finally {
      this.restoring.set(null);
    }
  }

  protected async delete(contact: ContactSummary): Promise<void> {
    const ref = this.dialogs.open<boolean, ContactRef>(DeleteContactDialog, {
      data: { contactId: contact.id, name: contact.name },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.remove(contact);
    this.toasts.show({
      variant: 'success',
      heading: 'Contact deleted',
      text: `${contact.name} and your notes are gone for good.`,
    });
  }

  private remove(contact: ContactSummary): void {
    this.list.update((list) => list.filter((c) => c.id !== contact.id));
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.list.set(await firstValueFrom(this.contacts.listArchived()));
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'error',
      );
    }
  }
}
