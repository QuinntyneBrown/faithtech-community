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
  IconComponent,
  LinkComponent,
  StackComponent,
  TextareaComponent,
} from '@faithtech-community/components';

import { HubSectionWizardData, SectionSaver, mapsLink, sectionContent } from '../../hub-sections';

const MAX_DIRECTIONS = 500;
let next = 0;

/**
 * The Venue wizard (L2-160 AC1), matching docs/mocks/dialogs/hub-venue: the event's venue and a map link built from it,
 * and optional directions. An online event has no venue, so it says the hub shows the joining link and offers Close.
 * Closes with true once saved.
 */
@Component({
  selector: 'ft-hub-venue-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    IconComponent,
    LinkComponent,
    StackComponent,
    TextareaComponent,
  ],
  templateUrl: './hub-venue.dialog.html',
  styleUrl: '../hub-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubVenueDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly hub = inject<HubSectionWizardData>(DIALOG_DATA).hub;
  protected readonly saver = new SectionSaver(
    inject(EVENT_HUBS_SERVICE),
    this.hub.eventId,
    'Venue',
  );
  private readonly errorFocus = viewChild(FormErrorFocusDirective);

  protected readonly questionId = `hub-venue-q-${++next}`;
  protected readonly factsId = `hub-venue-facts-${next}`;
  protected readonly maxDirections = MAX_DIRECTIONS;
  protected readonly online = this.hub.event.format === 'Online';
  protected readonly venue = this.hub.event.venue ?? '';
  protected readonly maps = this.venue ? mapsLink(this.venue) : null;
  protected readonly form = inject(NonNullableFormBuilder).group({
    directions: [sectionContent(this.hub, 'Venue')?.directions ?? ''],
  });

  protected async save(): Promise<void> {
    const directions = this.form.controls.directions.value.trim();
    if (directions.length > MAX_DIRECTIONS) {
      this.saver.errors.set({ directions: `Use ${MAX_DIRECTIONS} characters or fewer.` });
      this.errorFocus()?.focusFirstError();
      return;
    }
    if (await this.saver.save({ directions: directions || null })) this.ref.close(true);
    else if (!this.saver.failed()) this.errorFocus()?.focusFirstError();
  }
}
