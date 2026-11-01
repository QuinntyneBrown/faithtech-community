import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  LinkComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';

import { HubSectionWizardData, SectionSaver, sectionContent } from '../../hub-sections';

const MAX_LINE = 200;
let next = 0;

/**
 * The Giving wizard (L2-158 AC3, AC5), matching docs/mocks/dialogs/hub-giving: the organisation's giving link and text,
 * read from Organisation settings, and an optional event line. Without a giving link it says where to add one. Closes
 * with true once saved.
 */
@Component({
  selector: 'ft-hub-giving-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    LinkComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './hub-giving.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubGivingDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Giving',
  );
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly questionId = `hub-giving-q-${++next}`;
  protected readonly factsId = `hub-giving-facts-${next}`;
  protected readonly maxLine = MAX_LINE;
  protected readonly organisation = this.hub.organisation;
  protected readonly form = inject(NonNullableFormBuilder).group({
    line: [sectionContent(this.hub, 'Giving')?.line ?? ''],
  });

  protected async save(): Promise<void> {
    const line = this.form.controls.line.value.trim();
    if (line.length > MAX_LINE) {
      this.saver.errors.set({ line: `Use ${MAX_LINE} characters or fewer.` });
      this.errorFocus().focusFirstError();
      return;
    }
    if (await this.saver.save({ line: line || null })) this.ref.close(true);
    else if (!this.saver.failed()) this.errorFocus().focusFirstError();
  }
}
