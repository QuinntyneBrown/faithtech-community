import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ButtonComponent,
  DialogComponent,
  EmojiPickerComponent,
  FormFieldComponent,
  TextFieldComponent,
} from '@faithtech-community/components';

export interface PageSettings {
  title: string;
  icon: string | null;
}

const MAX_TITLE = 200;

/**
 * "Page settings": the title and icon (L2-086 AC3), as in docs/mocks/dialogs/note-settings. Closes with both;
 * the page saves them through its usual autosave.
 */
@Component({
  selector: 'ft-note-settings-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    DialogComponent,
    EmojiPickerComponent,
    FormFieldComponent,
    TextFieldComponent,
  ],
  templateUrl: './note-settings.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteSettingsDialog {
  protected readonly ref = inject<DialogRef<PageSettings>>(DialogRef);
  private readonly current = inject<PageSettings>(DIALOG_DATA);
  protected readonly title = new FormControl(this.current.title, { nonNullable: true });
  protected readonly icon = new FormControl<string | null>(this.current.icon);
  protected readonly error = signal('');

  protected save(): void {
    const title = this.title.value.trim();
    if (title.length > MAX_TITLE) {
      this.error.set(`Use ${MAX_TITLE} characters or fewer for the title.`);
      return;
    }
    this.ref.close({ title, icon: this.icon.value });
  }
}
