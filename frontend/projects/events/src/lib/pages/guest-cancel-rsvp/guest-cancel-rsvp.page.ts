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
import { EVENTS_SERVICE, OrganisationNames, PublicEventDto } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  PageHeaderComponent,
  StackComponent,
  formatTimeRange,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'confirm' | 'done' | 'invalid';

/**
 * Where the cancel link in a guest's confirmation lands (L2-023 AC6), matching docs/mocks/pages/guest-cancel-rsvp.
 * Following the link changes nothing: the guest confirms, so link scanners in mail apps cannot cancel an RSVP.
 */
@Component({
  selector: 'ft-guest-cancel-rsvp-page',
  imports: [
    AlertComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    StackComponent,
  ],
  templateUrl: './guest-cancel-rsvp.page.html',
  styleUrl: './guest-cancel-rsvp.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestCancelRsvpPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly events = inject(EVENTS_SERVICE);

  /** Route parameter. */
  readonly id = input.required<string>();
  /** The secret from the cancel link's query string. */
  readonly token = input<string>('');

  protected readonly state = signal<State>('confirm');
  protected readonly event = signal<PublicEventDto | null>(null);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected readonly eventHref = computed(() => `/public/events/${this.id()}`);
  protected readonly overline = computed(() => {
    const e = this.event();
    return e ? `${this.organisation.shortName()} ${e.city} · Public event` : 'Public event';
  });
  protected readonly subtitle = computed(() => {
    const e = this.event();
    if (!e) return null;
    return `${formatTimeRange(e.startsAt, e.endsAt)} · ${e.format === 'Online' ? 'Online' : e.venue}`;
  });

  constructor() {
    effect(() => void this.loadEvent(this.id()));
  }

  protected async cancel(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.events.cancelGuestRsvp(this.id(), this.token()));
      this.state.set('done');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) this.state.set('invalid');
      else this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  // The event only dresses the page; the cancel works without it.
  private async loadEvent(id: string): Promise<void> {
    try {
      this.event.set(await firstValueFrom(this.events.getPublicEvent(id)));
    } catch {
      this.event.set(null);
    }
  }
}
