import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  EVENT_HUBS_SERVICE,
  EventHubDto,
  LinksContent,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { sectionContent } from '../../hub-sections';

export interface SwapHubLinkData {
  hub: EventHubDto;
}

type Which = 'submission' | 'feedback';

const FIELD: Record<Which, 'submissionUrl' | 'feedbackUrl'> = {
  submission: 'submissionUrl',
  feedback: 'feedbackUrl',
};

/**
 * Swap a link (L2-191), matching docs/mocks/dialogs/swap-hub-link: choose Submission or Feedback and give its new
 * address. Saves the Submission and feedback section with the other link and the code freeze unchanged (ADR 0044).
 * Closes with the link that changed.
 */
@Component({
  selector: 'ft-swap-hub-link-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './swap-hub-link.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwapHubLinkDialog {
  protected readonly ref = inject<DialogRef<Which>>(DialogRef);
  private readonly data = inject<SwapHubLinkData>(DIALOG_DATA);
  private readonly hubs = inject(EVENT_HUBS_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  private readonly links: LinksContent = sectionContent(this.data.hub, 'Links') ?? {
    submissionUrl: null,
    feedbackUrl: null,
    codeFreezeAt: null,
  };
  protected readonly form = inject(NonNullableFormBuilder).group({
    which: ['submission' as Which],
    link: [this.links.submissionUrl ?? ''],
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly error = signal('');

  constructor() {
    // Switching the choice switches the address (L2-191 AC1).
    this.form.controls.which.valueChanges.pipe(takeUntilDestroyed()).subscribe((which) => {
      this.form.controls.link.setValue(this.links[FIELD[which]] ?? '');
      this.error.set('');
    });
  }

  protected async swap(): Promise<void> {
    if (this.busy()) return;
    const which = this.form.controls.which.value;
    const link = this.form.controls.link.value.trim();
    this.error.set(
      !link
        ? 'Enter a link.'
        : !/^https:\/\/\S+$/i.test(link)
          ? 'Use a link that starts with https://'
          : '',
    );
    if (this.error()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(
        this.hubs.saveSection(this.data.hub.eventId, 'Links', {
          ...this.links,
          [FIELD[which]]: link,
        }),
      );
      this.ref.close(which);
    } catch (error) {
      const refused =
        error instanceof HttpErrorResponse && error.status === 400
          ? problemDetails(error)?.errors?.[FIELD[which]]?.[0]
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
