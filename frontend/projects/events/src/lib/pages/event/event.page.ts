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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EVENTS_SERVICE, EventDetailDto, RsvpDto, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  AvatarComponent,
  BadgeComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogService,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  LinkComponent,
  ListComponent,
  ListItemComponent,
  PageHeaderComponent,
  SkeletonComponent,
  SplitComponent,
  StackComponent,
  TextFieldComponent,
  ToastService,
  avatarColorFor,
  formatDay,
  formatTimeRange,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { CancelRsvpData, CancelRsvpDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error';

/**
 * One event (L2-022), matching docs/mocks/pages/event: RSVP and cancel an RSVP, the RSVP count for attendees and
 * the RSVP list with Export CSV for leads, Staff and System Admins (the server decides who gets the list).
 */
@Component({
  selector: 'ft-event-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    LinkComponent,
    ListComponent,
    ListItemComponent,
    PageHeaderComponent,
    SkeletonComponent,
    SplitComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './event.page.html',
  styleUrl: './event.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventPage {
  private readonly events = inject(EVENTS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly event = signal<EventDetailDto | null>(null);
  protected readonly rsvping = signal(false);
  protected readonly exporting = signal(false);
  protected readonly downloading = signal(false);
  /** Why the server refused the RSVP, such as "This event is full.". */
  protected readonly refusal = signal<string | null>(null);

  protected readonly when = computed(() => {
    const e = this.event();
    return e ? formatTimeRange(e.startsAt, e.endsAt) : '';
  });
  protected readonly where = computed(() => {
    const e = this.event();
    if (!e) return '';
    return e.format === 'Online' ? 'Online' : `${e.venue}, ${e.city}`;
  });
  protected readonly host = computed(() => {
    const e = this.event();
    if (!e?.hostName) return null;
    return e.hostRole ? `${e.hostName}, ${e.hostRole}` : e.hostName;
  });
  /** The share link anyone can open (L2-023 AC1). */
  protected readonly publicPath = computed(() => `/public/events/${this.id()}`);
  protected readonly publicUrl = computed(() => `${location.origin}${this.publicPath()}`);
  protected readonly shareLink = new FormControl('', { nonNullable: true });
  protected readonly started = computed(() => {
    const e = this.event();
    return !!e && new Date(e.startsAt).getTime() <= Date.now();
  });
  protected readonly canRsvp = computed(() => {
    const e = this.event();
    return !!e && !e.callerHasRsvp && !e.isCancelled && !e.isFull && !this.started();
  });

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected retry(): void {
    void this.load(this.id());
  }

  /** Members keep their profile colour (ADR 0008); guests stay plain. */
  protected color(rsvp: RsvpDto) {
    return avatarColorFor(rsvp.profileId);
  }

  protected meta(rsvp: RsvpDto): string {
    const day = `RSVP’d ${formatDay(rsvp.rsvpedAt)}`;
    if (!rsvp.isGuest) return `Member · ${day}`;
    return rsvp.guestEmail ? `Guest · ${rsvp.guestEmail} · ${day}` : `Guest · ${day}`;
  }

  protected async rsvp(): Promise<void> {
    if (this.rsvping()) return;
    this.rsvping.set(true);
    this.refusal.set(null);
    try {
      await firstValueFrom(this.events.rsvp(this.id()));
    } catch (error) {
      this.refusal.set(
        error instanceof HttpErrorResponse && error.status === 409
          ? (problemDetails(error)?.detail ?? 'This event isn’t taking RSVPs.')
          : 'We couldn’t reach FaithTech, so you’re not on the list yet. Try again.',
      );
    } finally {
      this.rsvping.set(false);
    }
    await this.load(this.id(), false);
  }

  protected async cancelRsvp(): Promise<void> {
    const e = this.event();
    if (!e) return;
    const ref = this.dialogs.open<boolean, CancelRsvpData>(CancelRsvpDialog, {
      data: { eventId: e.id, hostName: e.hostName },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({
      variant: 'success',
      heading: 'Your RSVP is cancelled',
      text: 'You can RSVP again any time before the event.',
    });
    await this.load(this.id(), false);
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl());
      this.toasts.show({
        variant: 'success',
        heading: 'Link copied',
        text: `Anyone with the link can see ${this.event()?.title} and RSVP.`,
      });
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t copy the link',
        text: 'Select the link and copy it yourself.',
      });
    }
  }

  /** Saves the event's .ics, fetched with the member's sign-in (L2-024). */
  protected async addToCalendar(): Promise<void> {
    const e = this.event();
    if (!e || this.downloading()) return;
    this.downloading.set(true);
    try {
      save(await firstValueFrom(this.events.downloadCalendar(e.id)), `${slug(e.title)}.ics`);
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t download the calendar file',
        text: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () => void this.addToCalendar(),
      });
    } finally {
      this.downloading.set(false);
    }
  }

  protected async exportCsv(): Promise<void> {
    const e = this.event();
    if (!e || this.exporting()) return;
    this.exporting.set(true);
    const fileName = `${slug(e.title)}-rsvps.csv`;
    try {
      save(await firstValueFrom(this.events.exportRsvps(e.id)), fileName);
      this.toasts.show({
        variant: 'success',
        heading: 'RSVP list exported',
        text: `${fileName} is in your downloads.`,
      });
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t export the RSVP list',
        text: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () => void this.exportCsv(),
      });
    } finally {
      this.exporting.set(false);
    }
  }

  private async load(id: string, showLoading = true): Promise<void> {
    if (showLoading) this.state.set('loading');
    try {
      const event = await firstValueFrom(this.events.getEvent(id));
      if (id !== this.id()) return;
      this.event.set(event);
      this.shareLink.setValue(this.publicUrl());
      this.state.set('loaded');
    } catch {
      if (id === this.id()) this.state.set('error');
    }
  }
}

/** Hands a downloaded file to the browser under the given name. */
function save(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** The same file-name slug as the server's EventFileNames. */
function slug(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return words.slice(0, 60).replace(/-+$/, '') || 'event';
}
