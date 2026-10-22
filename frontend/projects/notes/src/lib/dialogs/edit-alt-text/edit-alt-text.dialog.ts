import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  TextFieldComponent,
} from '@faithtech-community/components';

import { altError } from '../add-image/add-image.dialog';

/** "Edit alt text" for an image block (L2-097 AC8). Closes with the new alt text. */
@Component({
  selector: 'ft-edit-alt-text-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    TextFieldComponent,
  ],
  templateUrl: './edit-alt-text.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditAltTextDialog {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly alt = new FormControl(inject<string>(DIALOG_DATA), { nonNullable: true });
  protected readonly error = signal('');

  protected save(): void {
    this.error.set(altError(this.alt.value));
    if (!this.error()) this.ref.close(this.alt.value.trim());
  }
}
