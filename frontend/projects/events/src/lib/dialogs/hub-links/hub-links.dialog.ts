import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
  TextFieldComponent,
  formatTime,
} from '@faithtech-community/components';

import { HubSectionWizardData, SectionSaver, sectionContent } from '../../hub-sections';

const MAX_LINK = 500;
const HTTPS = 'Use a link that starts with https://';
const HTTPS_LINK = /^https:\/\/\S+$/;
let next = 0;

function linkOk(value: string): boolean {
  return !value || (value.length <= MAX_LINK && HTTPS_LINK.test(value));
}

/**
 * The Submission and feedback wizard (L2-160 AC3), matching docs/mocks/dialogs/hub-links: optional https submission and
 * feedback links and a code freeze picked from the agenda's rows; without an agenda the picker is disabled. Closes with
 * true once saved.
 */
@Component({
  selector: 'ft-hub-links-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    SelectComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './hub-links.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubLinksDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Links',
  );
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly questionId = `hub-links-q-${++next}`;
  private readonly links = sectionContent(this.hub, 'Links');
  /** One option per agenda row, such as "8:00 pm Code freeze". */
  protected readonly rows: SelectOption[] = (sectionContent(this.hub, 'Agenda')?.items ?? []).map(
    (item) => ({
      value: new Date(item.startsAt).toISOString(),
      label: `${formatTime(item.startsAt)} ${item.title}`,
    }),
  );
  protected readonly codeFreezeHelp = this.rows.length
    ? 'Pick a row from the agenda'
    : 'Add an agenda first to pick a code-freeze time.';
  protected readonly form = inject(NonNullableFormBuilder).group({
    submissionUrl: [this.links?.submissionUrl ?? ''],
    feedbackUrl: [this.links?.feedbackUrl ?? ''],
    codeFreezeAt: [
      {
        value: this.links?.codeFreezeAt ? new Date(this.links.codeFreezeAt).toISOString() : '',
        disabled: this.rows.length === 0,
      },
    ],
  });

  protected async save(): Promise<void> {
    const { submissionUrl, feedbackUrl, codeFreezeAt } = this.form.getRawValue();
    const submission = submissionUrl.trim();
    const feedback = feedbackUrl.trim();
    const errors: Record<string, string> = {};
    if (!linkOk(submission)) errors['submissionUrl'] = HTTPS;
    if (!linkOk(feedback)) errors['feedbackUrl'] = HTTPS;
    if (Object.keys(errors).length) {
      this.saver.errors.set(errors);
      this.errorFocus().focusFirstError();
      return;
    }
    const saved = await this.saver.save({
      submissionUrl: submission || null,
      feedbackUrl: feedback || null,
      codeFreezeAt: this.rows.length && codeFreezeAt ? codeFreezeAt : null,
    });
    if (saved) this.ref.close(true);
    else if (!this.saver.failed()) this.errorFocus().focusFirstError();
  }
}
