import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import { ListComponent, ListItemComponent } from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/** The What to bring display (L2-174 AC2): the list to bring, then what to expect on the day. */
@Component({
  selector: 'ft-hub-what-to-bring',
  imports: [ListComponent, ListItemComponent],
  templateUrl: './hub-what-to-bring.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubWhatToBringComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-what-to-bring-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'WhatToBring'));
}
