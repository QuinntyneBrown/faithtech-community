import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AgendaItem } from '@faithtech-community/api';
import { ListComponent, ListItemComponent, formatTime } from '@faithtech-community/components';

let next = 0;

/**
 * The Agenda display (L2-159 AC7, docs/design-system/patterns/event-hub-sections.html): each row's time, what is
 * happening and its detail, in the order saved.
 */
@Component({
  selector: 'ft-hub-agenda',
  imports: [ListComponent, ListItemComponent],
  templateUrl: './hub-agenda.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubAgendaComponent {
  readonly items = input.required<readonly AgendaItem[]>();

  protected readonly id = `hub-agenda-${++next}`;
  protected readonly rows = computed(() =>
    this.items().map((item) => ({ ...item, time: formatTime(item.startsAt) })),
  );
}
