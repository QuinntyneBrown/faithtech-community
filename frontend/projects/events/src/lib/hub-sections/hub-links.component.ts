import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  IconComponent,
  StackComponent,
  formatTime,
} from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/**
 * The Submission and feedback display (L2-160 AC4): Submit your project and Give feedback, only the ones set, and "Code
 * freeze at {time}" when one is picked.
 */
@Component({
  selector: 'ft-hub-links',
  imports: [ButtonComponent, CardComponent, ClusterComponent, IconComponent, StackComponent],
  templateUrl: './hub-links.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubLinksComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-links-${++next}`;
  protected readonly links = computed(() => sectionContent(this.hub(), 'Links'));
  protected readonly codeFreeze = computed(() => {
    const at = this.links()?.codeFreezeAt;
    return at ? `Code freeze at ${formatTime(at)}` : '';
  });
}
