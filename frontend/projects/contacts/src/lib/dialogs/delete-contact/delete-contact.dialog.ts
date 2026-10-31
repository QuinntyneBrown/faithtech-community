import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CONTACTS_SERVICE, OrganisationNames } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { ContactRef } from '../archive-contact';

const CONFIRMATION = 'DELETE';

/**
 * Deletes an archived contact and its notes for good (L2-016 AC3, AC4), matching
 * docs/mocks/dialogs/delete-contact. Delete stays disabled until the input is exactly DELETE.
 */
@Component({
  selector: 'ft-delete-contact-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './delete-contact.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteContactDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ContactRef>(DIALOG_DATA);
  private readonly contacts = inject(CONTACTS_SERVICE);

  protected readonly confirmation = new FormControl('', { nonNullable: true });
  private readonly typed = toSignal(this.confirmation.valueChanges, { initialValue: '' });
  private readonly left = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected readonly confirmed = computed(() => this.typed() === CONFIRMATION);
  /** Shown once the person leaves the field with something other than DELETE. */
  protected readonly error = computed(() =>
    this.left() && this.typed() !== '' && !this.confirmed()
      ? 'Type DELETE in capitals to confirm.'
      : '',
  );

  protected blurred(): void {
    this.left.set(true);
  }

  protected async confirm(): Promise<void> {
    if (this.busy() || !this.confirmed()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.contacts.delete(this.data.contactId));
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
