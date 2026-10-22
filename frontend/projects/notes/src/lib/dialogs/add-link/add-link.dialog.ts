import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  TextFieldComponent,
} from '@faithtech-community/components';

import { isHyperlink } from '../../note-links';

/** The link to set, or null to remove it. */
export interface LinkChoice {
  href: string | null;
}

/**
 * "Add a link", or "Edit link" with "Remove link" when the text is already linked (L2-088 AC3, AC4), as in
 * docs/mocks/dialogs/add-link.
 */
@Component({
  selector: 'ft-add-link-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    TextFieldComponent,
  ],
  templateUrl: './add-link.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddLinkDialog {
  protected readonly ref = inject<DialogRef<LinkChoice>>(DialogRef);
  protected readonly current = inject<{ href: string | null }>(DIALOG_DATA).href;
  protected readonly link = new FormControl(this.current ?? '', { nonNullable: true });
  protected readonly error = signal('');

  protected save(): void {
    const href = this.link.value.trim();
    if (!isHyperlink(href)) {
      this.error.set('Use a link that starts with https:// or mailto:');
      return;
    }
    this.ref.close({ href });
  }
}
