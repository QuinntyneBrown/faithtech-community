import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EventHubDto, HubSectionKind } from '@faithtech-community/api';
import { ButtonComponent, DialogComponent } from '@faithtech-community/components';

import {
  HubAgendaComponent,
  HubGivingComponent,
  HubHeroComponent,
  HubLinksComponent,
  HubVenueComponent,
  hubSection,
  sectionContent,
} from '../../hub-sections';

export interface HubSectionPreviewData {
  hub: EventHubDto;
  kind: HubSectionKind;
}

/** The kinds whose display the preview can show; each joins as its display lands. */
export const PREVIEWABLE: readonly HubSectionKind[] = [
  'Hero',
  'Agenda',
  'Venue',
  'Links',
  'Giving',
];

/**
 * "{Section} preview" (L2-156 AC5), matching docs/mocks/dialogs/hub-section-preview: the section rendered by its
 * display component as visitors will see it. Closes with 'edit' when Edit is chosen.
 */
@Component({
  selector: 'ft-hub-section-preview-dialog',
  imports: [
    ButtonComponent,
    DialogComponent,
    HubAgendaComponent,
    HubGivingComponent,
    HubHeroComponent,
    HubLinksComponent,
    HubVenueComponent,
  ],
  templateUrl: './hub-section-preview.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubSectionPreviewDialog {
  protected readonly ref = inject<DialogRef<'edit'>>(DialogRef);
  protected readonly data = inject<HubSectionPreviewData>(DIALOG_DATA);
  protected readonly title = hubSection(this.data.kind).title;
  protected readonly agenda = sectionContent(this.data.hub, 'Agenda')?.items ?? [];
}
