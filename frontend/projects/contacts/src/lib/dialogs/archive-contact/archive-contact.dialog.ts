import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CONTACTS_SERVICE } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** The contact a confirmation dialog acts on. */
export interface ContactRef {
  contactId: string;
  name: string;
}

/**
 * Confirms archiving a contact (L2-016 AC1), matching docs/mocks/dialogs/archive-contact.
 * Closes with true once the contact is archived.
 */
@Component({
  selector: 'ft-archive-contact-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './archive-contact.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchiveContactDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ContactRef>(DIALOG_DATA);
  private readonly contacts = inject(CONTACTS_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.contacts.archive(this.data.contactId));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
