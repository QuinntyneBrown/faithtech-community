import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import {
  IconTileComponent,
  LinkComponent,
  ListComponent,
  ListItemComponent,
} from '@faithtech-community/components';

import { initials } from './hackathon';
import { sectionContent } from './section-saver';

let next = 0;

/** The Partners display (L2-175 AC3): the introduction, then each partner read live from Partners, with its initials while Partners has no logo. */
@Component({
  selector: 'ft-hub-partners',
  imports: [IconTileComponent, LinkComponent, ListComponent, ListItemComponent],
  templateUrl: './hub-partners.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubPartnersComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-partners-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'Partners'));

  protected readonly initials = initials;

  /** "baptizetheworld.example.org" from the partner's website. */
  protected host(url: string): string {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
