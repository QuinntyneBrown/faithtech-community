import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import { ListComponent, ListItemComponent } from '@faithtech-community/components';

import { demoLine, segmentTimes } from './hackathon';
import { sectionContent } from './section-saver';

let next = 0;

/** The Demo format display (L2-179 AC3): how long demos and questions run, each segment’s time, then the tips. */
@Component({
  selector: 'ft-hub-demo-format',
  imports: [ListComponent, ListItemComponent],
  templateUrl: './hub-demo-format.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubDemoFormatComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-demo-format-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'DemoFormat'));

  protected readonly line = computed(() => {
    const c = this.content();
    return c ? demoLine(c.minutes, c.questionMinutes) : null;
  });
  protected readonly times = computed(() =>
    segmentTimes((this.content()?.segments ?? []).map((s) => s.seconds)),
  );
}
