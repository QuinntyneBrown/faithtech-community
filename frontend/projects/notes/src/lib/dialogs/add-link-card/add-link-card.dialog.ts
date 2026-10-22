import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  TextFieldComponent,
} from '@faithtech-community/components';

import { isHttps } from '../../note-links';

export interface LinkCard {
  url: string;
  caption: string | null;
}

const MAX_CAPTION = 200;

/** "Add a link card" (L2-087 AC9), as in docs/mocks/dialogs/add-link-card. Closes with the link and caption. */
@Component({
  selector: 'ft-add-link-card-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    TextFieldComponent,
  ],
  templateUrl: './add-link-card.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddLinkCardDialog {
  protected readonly ref = inject<DialogRef<LinkCard>>(DialogRef);
  protected readonly url = new FormControl('', { nonNullable: true });
  protected readonly caption = new FormControl('', { nonNullable: true });
  protected readonly urlError = signal('');
  protected readonly captionError = signal('');

  protected add(): void {
    const url = this.url.value.trim();
    const caption = this.caption.value.trim();
    this.urlError.set(isHttps(url) ? '' : 'Use a link that starts with https://.');
    this.captionError.set(
      caption.length > MAX_CAPTION ? `Use ${MAX_CAPTION} characters or fewer for the caption.` : '',
    );
    if (this.urlError() || this.captionError()) return;
    this.ref.close({ url, caption: caption || null });
  }
}
