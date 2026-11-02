import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import { ListComponent, ListItemComponent } from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/** The Rules display (L2-178 AC2): the rules numbered 01, 02 in order, then the note. */
@Component({
  selector: 'ft-hub-rules',
  imports: [ListComponent, ListItemComponent],
  templateUrl: './hub-rules.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubRulesComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-rules-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'Rules'));

  protected number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
}
