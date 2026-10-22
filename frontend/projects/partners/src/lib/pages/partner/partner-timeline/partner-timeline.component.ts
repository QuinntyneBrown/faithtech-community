import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import {
  PARTNERS_SERVICE,
  PARTNER_ACTIVITY_LABELS,
  PartnerActivityDto,
  PartnerActivityKind,
} from '@faithtech-community/api';
import {
  FeedComponent,
  FeedItemComponent,
  FeedState,
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

/** A yyyy-MM-dd date (and HH:mm[:ss] time) as a local Date, so it prints as written. */
export function localDate(day: string, time: string | null = null): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/**
 * A partner's shared activity timeline (L2-086): every lead, Staff member and System Admin sees
 * the same entries, newest first. Feature composition only: `ft-feed` with typed `ft-feed-item`s.
 * Bump `reload` to fetch the first page again after a log or a move.
 */
@Component({
  selector: 'ft-partner-timeline',
  imports: [FeedComponent, FeedItemComponent],
  templateUrl: './partner-timeline.component.html',
  styleUrl: './partner-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerTimelineComponent {
  private readonly partners = inject(PARTNERS_SERVICE);

  readonly partnerId = input.required<string>();
  readonly reload = input(0);

  protected readonly state = signal<FeedState>('loading');
  protected readonly items = signal<PartnerActivityDto[]>([]);
  protected readonly retrying = signal(false);
  protected readonly labels = PARTNER_ACTIVITY_LABELS;
  protected readonly icons = ACTIVITY_ICONS;

  constructor() {
    effect(() => {
      this.reload();
      void this.load(this.partnerId());
    });
  }

  protected meta(activity: PartnerActivityDto): string {
    const at = localDate(activity.occurredOn, activity.occurredAt);
    return activity.occurredAt ? `${formatDay(at)}, ${formatTime(at)}` : formatDay(at);
  }

  protected due(activity: PartnerActivityDto): string {
    return activity.nextStepDue ? ` · ${formatDay(localDate(activity.nextStepDue))}` : '';
  }

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    await this.load(this.partnerId(), false);
    this.retrying.set(false);
  }

  private async load(id: string, showLoading = true): Promise<void> {
    if (showLoading) this.state.set('loading');
    try {
      const page = await firstValueFrom(this.partners.activities(id));
      this.items.set(page.items);
      this.state.set(page.items.length ? 'ready' : 'empty');
    } catch {
      this.state.set('error');
    }
  }
}
