import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ButtonComponent,
  DialogComponent,
  EmojiPickerComponent,
} from '@faithtech-community/components';

/** "Change icon" for a callout (L2-087 AC6): one emoji, never none. Closes with the emoji. */
@Component({
  selector: 'ft-change-icon-dialog',
  imports: [ReactiveFormsModule, ButtonComponent, DialogComponent, EmojiPickerComponent],
  templateUrl: './change-icon.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeIconDialog {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly icon = new FormControl<string | null>(inject<string>(DIALOG_DATA));
}
