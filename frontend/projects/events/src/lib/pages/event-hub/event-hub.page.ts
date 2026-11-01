import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { EVENT_HUBS_SERVICE, EventHubDto, HubSectionState } from '@faithtech-community/api';
import {
  BadgeComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  ChecklistRowComponent,
  ChecklistRowState,
  CopyFieldComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  EmptyStateComponent,
  IconComponent,
  ListComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  ProgressComponent,
  StackComponent,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { hubSection } from '../../hub-sections';

type State = 'loading' | 'loaded' | 'error' | 'forbidden' | 'no-hub';

const ROW_STATES: Record<HubSectionState, ChecklistRowState> = {
  Ready: 'ready',
  NeedsInfo: 'needs-info',
  Hidden: 'hidden',
};

/**
 * The hub home (L2-154), matching docs/mocks/pages/event-hub: the hub's status and link, how many sections are ready, and
 * one checklist row per section. The event's facts are read from the event through the API on every load.
 */
@Component({
  selector: 'ft-event-hub-page',
  imports: [
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    ChecklistRowComponent,
    CopyFieldComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    IconComponent,
    ListComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    ProgressComponent,
    StackComponent,
  ],
  templateUrl: './event-hub.page.html',
  styleUrl: './event-hub.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventHubPage {
  private readonly hubs = inject(EVENT_HUBS_SERVICE);

  /** The event's id, from the route. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly hub = signal<EventHubDto | null>(null);

  protected readonly subtitle = computed(() => {
    const h = this.hub();
    return h ? `${h.event.title} · ${formatDay(h.event.startsAt)}` : '';
  });
  protected readonly rows = computed(() =>
    (this.hub()?.sections ?? []).map((s) => ({
      ...hubSection(s.kind),
      state: ROW_STATES[s.state],
    })),
  );
  protected readonly shown = computed(() => this.rows().filter((r) => r.state !== 'hidden').length);
  protected readonly ready = computed(() => this.rows().filter((r) => r.state === 'ready').length);
  protected readonly progress = computed(() => `${this.ready()} of ${this.shown()} sections ready`);

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected retry(): void {
    void this.load(this.id());
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const hub = await firstValueFrom(this.hubs.get(id));
      if (id !== this.id()) return;
      this.hub.set(hub);
      this.state.set('loaded');
    } catch (error) {
      if (id !== this.id()) return;
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.state.set(status === 403 ? 'forbidden' : status === 404 ? 'no-hub' : 'error');
    }
  }
}
