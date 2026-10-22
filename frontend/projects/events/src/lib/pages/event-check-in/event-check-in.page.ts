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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  CHECK_IN_SERVICE,
  CheckInAttendeeDto,
  CheckInDto,
  WalkInResultDto,
} from '@faithtech-community/api';
import {
  AlertComponent,
  AvatarComponent,
  BadgeComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  ProgressComponent,
  StackComponent,
  SwitchComponent,
  TextFieldComponent,
  ToastService,
  avatarColorFor,
  formatDay,
  formatTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { AddWalkInData, AddWalkInDialog } from '../../dialogs';
import { fileSlug, saveFile } from '../../download';

type State = 'loading' | 'loaded' | 'error' | 'forbidden' | 'not-found';

/**
 * Check-in at the door (L2-117 to L2-119), matching docs/mocks/pages/event-check-in: every attendee in RSVP order
 * with a switch that saves at once, the attendance meter and a search by name or email. A failed save turns the
 * switch back, so the list never shows a check-in the server does not have.
 */
@Component({
  selector: 'ft-event-check-in-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    ProgressComponent,
    StackComponent,
    SwitchComponent,
    TextFieldComponent,
  ],
  templateUrl: './event-check-in.page.html',
  styleUrl: './event-check-in.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventCheckInPage {
  private readonly service = inject(CHECK_IN_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly checkIn = signal<CheckInDto | null>(null);
  protected readonly attendees = signal<CheckInAttendeeDto[]>([]);
  protected readonly exporting = signal(false);
  protected readonly query = new FormControl('', { nonNullable: true });
  private readonly term = toSignal(this.query.valueChanges, { initialValue: '' });
  /** Saves for one attendee run in order, so a quick on-off-on lands as the last choice. */
  private readonly saves = new Map<string, Promise<void>>();

  protected readonly searchTerm = computed(() => this.term().trim());
  protected readonly shown = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.attendees();
    return this.attendees().filter(
      (a) => a.name.toLowerCase().includes(term) || !!a.email?.toLowerCase().includes(term),
    );
  });
  protected readonly going = computed(() => this.attendees().length);
  protected readonly checkedIn = computed(
    () => this.attendees().filter((a) => a.checkedInAt).length,
  );
  protected readonly walkIns = computed(() => this.attendees().filter((a) => a.isWalkIn).length);
  /** "Wed 21 Oct · 6:30 pm · Kestrel Labs", then "· 2 walk-ins" once any are added. */
  protected readonly subtitle = computed(() => {
    const c = this.checkIn();
    if (!c) return '';
    const where = c.format === 'Online' ? 'Online' : c.venue;
    const n = this.walkIns();
    const walkIns = n ? `${n} walk-in${n === 1 ? '' : 's'}` : null;
    return [formatDay(c.startsAt), formatTime(c.startsAt), where, walkIns]
      .filter(Boolean)
      .join(' · ');
  });
  /** "Mira" for the search "mira": the name the no-results action offers to add. */
  protected readonly termAsName = computed(() =>
    this.searchTerm().replace(
      /(^|\s)(\S)/g,
      (_m, space: string, c: string) => space + c.toUpperCase(),
    ),
  );
  /** "Check-in opens Wed 5 Nov at 6:30 pm, 24 hours before the event." (L2-119 AC6). */
  protected readonly opens = computed(() => {
    const c = this.checkIn();
    if (!c) return '';
    return `Check-in opens ${formatDay(c.checkInOpensAt)} at ${formatTime(c.checkInOpensAt)}, 24 hours before the event.`;
  });
  /** "Everyone’s here" once every attendee is in; it promises no follow-up email (L2-119 AC7). */
  protected readonly everyone = computed(() => {
    const going = this.going();
    if (!going || this.checkedIn() < going) return null;
    const w = this.walkIns();
    const walkIns = `${w} walk-in${w === 1 ? '' : 's'}`;
    const rsvped = going - w;
    if (!rsvped) return `${walkIns} checked in. Attendance now shows on the event page.`;
    const plus = w ? `, plus ${walkIns}` : '';
    return `All ${rsvped} who RSVP’d are checked in${plus}. Attendance now shows on the event page.`;
  });
  protected readonly editable = computed(() => {
    const c = this.checkIn();
    return !!c && c.canEdit && c.isOpen;
  });

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected clearSearch(): void {
    this.query.setValue('');
  }

  /** Members keep their profile colour (ADR 0008); guests and walk-ins stay plain. */
  protected color(a: CheckInAttendeeDto) {
    return avatarColorFor(a.profileId);
  }

  /** "Member · Checked in 6:41 pm", "Guest · {email} · Not here yet", "Walk-in · {email} · …". */
  protected meta(a: CheckInAttendeeDto): string {
    const kind = a.isWalkIn ? 'Walk-in' : a.isGuest ? 'Guest' : 'Member';
    const status = a.checkedInAt ? `Checked in ${formatTime(a.checkedInAt)}` : 'Not here yet';
    return [kind, a.email, status].filter(Boolean).join(' · ');
  }

  /** The switch changed: show it at once, then save; a failure turns it back. */
  protected toggle(a: CheckInAttendeeDto, on: boolean): void {
    const previous = this.find(a.rsvpId)?.checkedInAt ?? null;
    if (!!previous === on) return;
    this.patch(a.rsvpId, { checkedInAt: on ? new Date().toISOString() : null });
    const queued = (this.saves.get(a.rsvpId) ?? Promise.resolve()).then(() =>
      this.save(a, on, previous),
    );
    this.saves.set(a.rsvpId, queued);
  }

  /** Downloads the attendance CSV; Export CSV stays busy until it is saved (L2-122 AC4). */
  protected async exportCsv(): Promise<void> {
    const c = this.checkIn();
    if (!c || this.exporting()) return;
    this.exporting.set(true);
    const fileName = `${fileSlug(c.title)}-attendance.csv`;
    try {
      saveFile(await firstValueFrom(this.service.exportAttendance(c.eventId)), fileName);
      this.toasts.show({
        variant: 'success',
        heading: 'Attendance exported',
        text: `${fileName} is in your downloads.`,
      });
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t export the attendance',
        text: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () => void this.exportCsv(),
      });
    } finally {
      this.exporting.set(false);
    }
  }

  /** Opens Add walk-in, with the unmatched search term as the name when there is one (L2-118 AC3). */
  protected async addWalkIn(name?: string): Promise<void> {
    const ref = this.dialogs.open<WalkInResultDto, AddWalkInData>(AddWalkInDialog, {
      data: name ? { eventId: this.id(), name } : { eventId: this.id() },
    });
    const result = await firstValueFrom(ref.closed);
    if (!result) return;
    const { attendee: a, reused } = result;
    if (this.find(a.rsvpId)) this.patch(a.rsvpId, a);
    else this.attendees.update((all) => [...all, a]);
    if (name) this.clearSearch();
    const here = `${this.checkedIn()} of ${this.going()} here.`;
    this.toasts.show(
      a.checkedInAt
        ? {
            variant: 'success',
            heading: reused
              ? `${a.name} already RSVP’d and is checked in`
              : `${a.name} is checked in`,
            text: `${formatTime(a.checkedInAt)} · ${here}`,
          }
        : {
            variant: 'success',
            heading: reused ? `${a.name} already RSVP’d` : `${a.name} is on the list`,
            text: 'Turn on their switch when they’re here.',
          },
    );
  }

  private async save(a: CheckInAttendeeDto, on: boolean, previous: string | null): Promise<void> {
    const eventId = this.id();
    try {
      if (on) {
        const saved = await firstValueFrom(this.service.checkIn(eventId, a.rsvpId));
        this.patch(a.rsvpId, { checkedInAt: saved.checkedInAt });
        this.toasts.show({
          variant: 'success',
          heading: `${a.name} is checked in`,
          text: `${saved.checkedInAt ? formatTime(saved.checkedInAt) : ''} · ${this.checkedIn()} of ${this.going()} here.`,
          actionLabel: 'Undo',
          onAction: () => this.toggle(a, false),
        });
      } else {
        await firstValueFrom(this.service.undoCheckIn(eventId, a.rsvpId));
      }
    } catch {
      this.patch(a.rsvpId, { checkedInAt: previous });
      this.toasts.show({
        variant: 'danger',
        heading: `Couldn’t save ${a.name}’s check-in. Try again.`,
        text: `The switch is back ${on ? 'off' : 'on'}; nothing was saved.`,
        actionLabel: 'Try again',
        onAction: () => this.toggle(a, on),
      });
    }
  }

  private find(rsvpId: string): CheckInAttendeeDto | undefined {
    return this.attendees().find((a) => a.rsvpId === rsvpId);
  }

  private patch(rsvpId: string, change: Partial<CheckInAttendeeDto>): void {
    this.attendees.update((all) => all.map((a) => (a.rsvpId === rsvpId ? { ...a, ...change } : a)));
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const checkIn = await firstValueFrom(this.service.getCheckIn(id));
      if (id !== this.id()) return;
      this.checkIn.set(checkIn);
      this.attendees.set(checkIn.attendees);
      this.state.set('loaded');
    } catch (error) {
      if (id !== this.id()) return;
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.state.set(status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'error');
    }
  }
}
