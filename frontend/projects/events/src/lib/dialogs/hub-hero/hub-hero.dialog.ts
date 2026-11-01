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
  StackComponent,
  TextFieldComponent,
  formatTimeRange,
} from '@faithtech-community/components';

import { HubSectionWizardData, SectionSaver, hubPlace, sectionContent } from '../../hub-sections';

const MAX_SUBTITLE = 140;
let next = 0;

/**
 * The Hero wizard (L2-158 AC1, L2-157), matching docs/mocks/dialogs/hub-hero: one question, the event's facts read from
 * the event, and an optional subtitle. Closes with true once saved.
 */
@Component({
  selector: 'ft-hub-hero-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './hub-hero.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubHeroDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(inject(EVENT_HUBS_SERVICE), this.hub.eventId, 'Hero');
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly questionId = `hub-hero-q-${++next}`;
  protected readonly factsId = `hub-hero-facts-${next}`;
  protected readonly maxSubtitle = MAX_SUBTITLE;
  protected readonly when = formatTimeRange(this.hub.event.startsAt, this.hub.event.endsAt);
  protected readonly place = hubPlace(this.hub);
  protected readonly form = inject(NonNullableFormBuilder).group({
    subtitle: [sectionContent(this.hub, 'Hero')?.subtitle ?? ''],
  });

  protected subtitleError(): string {
    return this.saver.error('subtitle');
  }

  protected async save(): Promise<void> {
    const subtitle = this.form.controls.subtitle.value.trim();
    if (subtitle.length > MAX_SUBTITLE) {
      this.saver.errors.set({ subtitle: `Use ${MAX_SUBTITLE} characters or fewer.` });
      this.errorFocus().focusFirstError();
      return;
    }
    if (await this.saver.save({ subtitle: subtitle || null })) this.ref.close(true);
    else if (!this.saver.failed()) this.errorFocus().focusFirstError();
  }
}
