import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  LOGGED_ACTIVITY_KINDS,
  PARTNERS_SERVICE,
  PARTNER_ACTIVITY_LABELS,
  PartnerActivityDto,
  PartnerActivityFilter,
  PartnerActivityKind,
} from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  ChipComponent,
  ChipGroupComponent,
  EmptyStateComponent,
  FeedComponent,
  FeedItemComponent,
  FeedState,
  LinkComponent,
  formatDay,
  formatTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** The icon tile each kind leads with (docs/screen-composition.md, Partner). */
export const ACTIVITY_ICONS: Record<PartnerActivityKind, string> = {
  Call: 'call',
  Email: 'email',
  Meeting: 'events',
  Note: 'edit',
  Added: 'add',
  StageMoved: 'move',
  Merged: 'merge',
  Restored: 'restore',
};

/** The type chips in order; null is All (L2-111 AC3). */
export const ACTIVITY_FILTERS: {
  value: PartnerActivityFilter | null;
  label: string;
  one: string;
  many: string;
}[] = [
  { value: null, label: 'All', one: 'entry', many: 'entries' },
  { value: 'Call', label: 'Calls', one: 'call', many: 'calls' },
  { value: 'Email', label: 'Emails', one: 'email', many: 'emails' },
  { value: 'Meeting', label: 'Meetings', one: 'meeting', many: 'meetings' },
  { value: 'Note', label: 'Notes', one: 'note', many: 'notes' },
  { value: 'Stage', label: 'Stage moves', one: 'stage move', many: 'stage moves' },
];

/** A yyyy-MM-dd date (and HH:mm[:ss] time) as a local Date, so it prints as written. */
export function localDate(day: string, time: string | null = null): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/**
 * A partner's shared activity timeline (L2-111), matching docs/mocks/pages/partner: the Activity
 * card with the type chips, `ft-feed` of typed `ft-feed-item`s newest first and Show older, 50 at a
 * time. Every lead, Staff member and System Admin sees the same entries. With no logged entries
 * for the chosen type it invites the lead to log one (`canLog`). Bump `reload` to fetch the first
 * page again after a log or a move.
 */
@Component({
  selector: 'ft-partner-timeline',
  imports: [
    ButtonComponent,
    CardComponent,
    ChipComponent,
    ChipGroupComponent,
    EmptyStateComponent,
    FeedComponent,
    FeedItemComponent,
    LinkComponent,
  ],
  templateUrl: './partner-timeline.component.html',
  styleUrl: './partner-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerTimelineComponent {
  private readonly partners = inject(PARTNERS_SERVICE);

  readonly partnerId = input.required<string>();
  readonly reload = input(0);
  /** Shows the empty state's Log activity button. */
  readonly canLog = input(false);
  /** The empty state's Log activity was pressed. */
  readonly logRequested = output<void>();

  protected readonly filters = ACTIVITY_FILTERS;
  protected readonly filter = signal<PartnerActivityFilter | null>(null);
  protected readonly state = signal<FeedState>('loading');
  protected readonly items = signal<PartnerActivityDto[]>([]);
  protected readonly before = signal<string | null>(null);
  protected readonly loadingOlder = signal(false);
  protected readonly retrying = signal(false);
  protected readonly labels = PARTNER_ACTIVITY_LABELS;
  protected readonly icons = ACTIVITY_ICONS;

  /** No call, email, meeting or note among the entries for the chosen type (mock activity-empty). */
  protected readonly untouched = computed(
    () =>
      this.state() !== 'loading' &&
      this.state() !== 'error' &&
      (this.filter() === 'Stage'
        ? this.items().length === 0
        : !this.items().some((a) => (LOGGED_ACTIVITY_KINDS as readonly string[]).includes(a.kind))),
  );
  protected readonly caption = computed(() => {
    const chosen = this.filters.find((f) => f.value === this.filter())!;
    const n = this.items().length;
    return `${n}${this.before() ? '+' : ''} ${n === 1 ? chosen.one : chosen.many}.`;
  });

  constructor() {
    effect(() => {
      this.reload();
      const id = this.partnerId();
      void untracked(() => this.load(id));
    });
  }

  protected choose(value: PartnerActivityFilter | null): void {
    if (this.filter() === value) return;
    this.filter.set(value);
    void this.load(this.partnerId());
  }

  /** The date (and time), ending "· from {other}" on an entry a merge moved in. */
  protected meta(activity: PartnerActivityDto): string {
    const at = localDate(activity.occurredOn, activity.occurredAt);
    const when = activity.occurredAt ? `${formatDay(at)}, ${formatTime(at)}` : formatDay(at);
    return activity.mergedFromPartnerName
      ? `${when} · from ${activity.mergedFromPartnerName}`
      : when;
  }

  protected due(activity: PartnerActivityDto): string {
    return activity.nextStepDue ? ` · ${formatDay(localDate(activity.nextStepDue))}` : '';
  }

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    await this.load(this.partnerId(), false);
    this.retrying.set(false);
  }

  protected async showOlder(): Promise<void> {
    const before = this.before();
    if (!before || this.loadingOlder()) return;
    this.loadingOlder.set(true);
    try {
      const page = await firstValueFrom(
        this.partners.activities(this.partnerId(), this.filter(), before),
      );
      this.items.update((items) => [...items, ...page.items]);
      this.before.set(page.before);
    } catch {
      this.state.set('error');
    } finally {
      this.loadingOlder.set(false);
    }
  }

  private async load(id: string, showLoading = true): Promise<void> {
    if (showLoading) this.state.set('loading');
    try {
      const page = await firstValueFrom(this.partners.activities(id, this.filter()));
      this.items.set(page.items);
      this.before.set(page.before);
      this.state.set(page.items.length ? 'ready' : 'empty');
    } catch {
      this.state.set('error');
    }
  }
}
