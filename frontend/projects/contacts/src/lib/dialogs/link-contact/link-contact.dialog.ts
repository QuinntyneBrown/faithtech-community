import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CONTACTS_SERVICE, ContactDto, ContactMatch } from '@faithtech-community/api';
import {
  AlertComponent,
  AvatarComponent,
  ButtonComponent,
  ClusterComponent,
  DialogComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface LinkContactData {
  contactId: string;
  email: string | null;
  noteCount: number;
  member: ContactMatch;
}

/**
 * Links a contact to the member who signed up with its email (L2-015 AC2, AC5), matching
 * docs/mocks/dialogs/link-contact. Notes are kept unless the lead discards them. Closes with the
 * linked contact.
 */
@Component({
  selector: 'ft-link-contact-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    ButtonComponent,
    ClusterComponent,
    DialogComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
  ],
  templateUrl: './link-contact.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkContactDialog {
  protected readonly ref = inject<DialogRef<ContactDto>>(DialogRef);
  protected readonly data = inject<LinkContactData>(DIALOG_DATA);
  private readonly contacts = inject(CONTACTS_SERVICE);

  protected readonly notes = new FormControl<'keep' | 'discard'>('keep', { nonNullable: true });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly discardText = `Removes your ${this.data.noteCount} ${this.data.noteCount === 1 ? 'note' : 'notes'} after linking`;

  protected async link(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      const discard = this.notes.value === 'discard';
      this.ref.close(
        await firstValueFrom(
          this.contacts.link(this.data.contactId, this.data.member.profileId, discard),
        ),
      );
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
