import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  StackComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** HubQuickEditsHandler.MaxUpdate. */
export const MAX_HUB_UPDATE = 280;

export interface PostHubUpdateData {
  eventId: string;
  /** The live update, to change; absent when there is none. */
  current?: string | null;
}

/**
 * Post an update (L2-189 AC1 to AC3), matching docs/mocks/dialogs/post-hub-update: one question, one text area of up to
 * 280 characters, shown at the top of the hub at once. Closes with true once posted; a refused text shows on the field,
 * and a failed save keeps the text and offers Try again.
 */
@Component({
  selector: 'ft-post-hub-update-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    StackComponent,
    TextareaComponent,
  ],
  templateUrl: './post-hub-update.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostHubUpdateDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<PostHubUpdateData>(DIALOG_DATA);
  private readonly hubs = inject(EVENT_HUBS_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly max = MAX_HUB_UPDATE;
  protected readonly form = inject(NonNullableFormBuilder).group({
    text: [this.data.current ?? ''],
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly error = signal('');

  protected async post(): Promise<void> {
    if (this.busy()) return;
    const text = this.form.controls.text.value.trim();
    this.error.set(
      !text
        ? 'Write the update.'
        : text.length > MAX_HUB_UPDATE
          ? 'Use 280 characters or fewer.'
          : '',
    );
    if (this.error()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.hubs.setUpdate(this.data.eventId, text));
      this.ref.close(true);
    } catch (error) {
      const refused =
        error instanceof HttpErrorResponse && error.status === 400
          ? problemDetails(error)?.errors?.['text']?.[0]
          : undefined;
      if (refused) {
        this.error.set(refused);
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
