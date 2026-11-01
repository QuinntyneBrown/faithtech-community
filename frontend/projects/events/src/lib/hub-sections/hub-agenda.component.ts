import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { AgendaItem } from '@faithtech-community/api';
import {
  BadgeComponent,
  ListComponent,
  ListItemComponent,
  formatTime,
} from '@faithtech-community/components';
import { AgendaRowState, agendaStates } from './agenda';

let next = 0;

/** How often the live agenda looks at the clock (L2-168 AC3). */
const TICK = 30_000;

/**
 * The Agenda display (L2-159 AC7, docs/design-system/patterns/event-hub-sections.html): each row's time, what is
 * happening and its detail, in the order saved. On the hub page it is live (L2-168): finished rows are muted, the row
 * in progress shows Happening now and the next Up next, and a polite live region announces only a change of session.
 */
@Component({
  selector: 'ft-hub-agenda',
  imports: [BadgeComponent, ListComponent, ListItemComponent],
  templateUrl: './hub-agenda.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubAgendaComponent {
  readonly items = input.required<readonly AgendaItem[]>();
  /** Live states on the hub page; the section preview leaves them off (L2-168 AC6). */
  readonly live = input(false);
  /** The event's end, where the last row ends. */
  readonly eventEnd = input<string | null>(null);

  protected readonly id = `hub-agenda-${++next}`;
  private readonly now = signal(new Date());
  private readonly states = computed<AgendaRowState[]>(() => {
    const end = this.eventEnd();
    return this.live() && end ? agendaStates(this.items(), end, this.now()) : [];
  });
  protected readonly rows = computed(() => {
    const states = this.states();
    return this.items().map((item, i) => ({
      ...item,
      time: formatTime(item.startsAt),
      state: states[i] ?? 'later',
    }));
  });
  protected readonly finished = computed(() => {
    const states = this.states();
    return states.length > 0 && states.every((s) => s === 'finished');
  });
  protected readonly announcement = signal('');

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), TICK);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Announce only when the session in progress changes, never on first load (L2-168 AC3).
    let previous: string | null = null;
    effect(() => {
      const current = this.finished()
        ? 'This event has finished.'
        : (this.rows().find((r) => r.state === 'now')?.title ?? '');
      untracked(() => {
        if (previous !== null && current !== previous && current)
          this.announcement.set(
            current === 'This event has finished.' ? current : `Happening now: ${current}`,
          );
        previous = current;
      });
    });
  }
}
