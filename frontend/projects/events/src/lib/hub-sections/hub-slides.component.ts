import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { SlideViewerComponent, SlideViewerSlide } from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/** The Slides display (L2-182 AC2): the slides in order, served through the hub, stepped with the arrows or a thumbnail. */
@Component({
  selector: 'ft-hub-slides',
  imports: [SlideViewerComponent],
  templateUrl: './hub-slides.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubSlidesComponent {
  readonly hub = input.required<EventHubDto>();
  private readonly hubs = inject(EVENT_HUBS_SERVICE);

  protected readonly id = `hub-slides-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'Slides'));

  protected readonly helpId = `${this.id}-help`;
  protected readonly slides = computed<SlideViewerSlide[]>(() =>
    (this.content()?.slides ?? []).map((s) => ({
      src: this.hubs.fileUrl(this.hub().eventId, s.resourceId),
      thumbnailSrc: this.hubs.fileUrl(this.hub().eventId, s.resourceId, true),
      title: s.title,
      kind: s.kind === 'Pdf' ? 'pdf' : 'image',
    })),
  );
}
