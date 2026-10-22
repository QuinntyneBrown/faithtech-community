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
import { CHECK_IN_SERVICE, CheckInAttendeeDto, CheckInDto } from '@faithtech-community/api';
import {
  AvatarComponent,
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
  ToastService,
  avatarColorFor,
  formatDay,
  formatTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';

/**
 * Check-in at the door (L2-092 to L2-094), matching docs/mocks/pages/event-check-in: every attendee in RSVP order
 * with a switch that saves at once, the attendance meter and a search by name or email. A failed save turns the
 * switch back, so the list never shows a check-in the server does not have.
 */
@Component({
  selector: 'ft-event-check-in-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    AvatarComponent,
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

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly checkIn = signal<CheckInDto | null>(null);
  protected readonly attendees = signal<CheckInAttendeeDto[]>([]);
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
  /** "Wed 21 Oct · 6:30 pm · Kestrel Labs". */
  protected readonly subtitle = computed(() => {
    const c = this.checkIn();
    if (!c) return '';
    const where = c.format === 'Online' ? 'Online' : c.venue;
    return [formatDay(c.startsAt), formatTime(c.startsAt), where].filter(Boolean).join(' · ');
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

  /** "Member · Checked in 6:41 pm", "Guest · {email} · Not here yet". */
  protected meta(a: CheckInAttendeeDto): string {
    const kind = a.isGuest ? 'Guest' : 'Member';
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
    } catch {
      if (id === this.id()) this.state.set('error');
    }
  }
}
