import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EVENTS_SERVICE, PublicEventDto, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  EmptyStateComponent,
  ErrorSummaryComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  IconComponent,
  PageHeaderComponent,
  SkeletonComponent,
  SplitComponent,
  StackComponent,
  TextFieldComponent,
  formatDay,
  formatTimeRange,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';
type Field = 'name' | 'email';

// The same words as the server's GuestRsvpValidator; the server is the authority.
const NAME_MESSAGE = 'Enter your name so the host knows who’s coming.';
const EMAIL_MESSAGE = 'Enter an email like name@example.org.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The error summary words the errors as short links (docs/mocks/pages/public-event/invalid).
const SUMMARY: Record<Field, string> = { name: 'Enter your name', email: 'Enter a valid email' };
const LABELS: Record<Field, string> = { name: 'Your name', email: 'Email' };

/**
 * A public event's share page for anyone, signed in or not (L2-023), matching docs/mocks/pages/public-event: the
 * event and a guest RSVP form that needs no account. A members-only or unknown event sends the visitor to sign in.
 */
@Component({
  selector: 'ft-public-event-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonComponent,
    SplitComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './public-event.page.html',
  styleUrl: './public-event.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicEventPage {
  private readonly events = inject(EVENTS_SERVICE);
  private readonly router = inject(Router);
  private readonly formFields = viewChildren(FormFieldComponent);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({ name: [''], email: [''] });
  protected readonly state = signal<State>('loading');
  protected readonly event = signal<PublicEventDto | null>(null);
  protected readonly busy = signal(false);
  protected readonly failure = signal<{ heading: string; text: string } | null>(null);
  /** The guest's name and email once they are on the list. */
  protected readonly confirmed = signal<{ firstName: string; email: string } | null>(null);
  private readonly submitted = signal(false);
  private readonly version = signal(0);

  protected readonly calendarUrl = computed(() =>
    this.events.calendarUrl(this.id(), { isPublic: true }),
  );
  protected readonly signInHref = computed(
    () => `/sign-in?returnUrl=${encodeURIComponent(`/events/${this.id()}`)}`,
  );
  protected readonly overline = computed(
    () => `FaithTech ${this.event()?.city ?? ''} · Public event`,
  );
  protected readonly subtitle = computed(() => {
    const e = this.event();
    if (!e) return '';
    if (e.isCancelled) return `Was ${formatDay(e.startsAt)} · ${e.city}`;
    const place = e.format === 'Online' ? 'Online' : e.venue;
    return `${formatTimeRange(e.startsAt, e.endsAt)} · ${place}`;
  });
  protected readonly where = computed(() => {
    const e = this.event();
    if (!e) return '';
    return e.format === 'Online'
      ? 'Online — the link comes with your confirmation'
      : `${e.venue}, ${e.city}`;
  });
  protected readonly errors = computed(() => {
    this.version();
    if (!this.submitted()) return [] as { field: Field; message: string }[];
    const v = this.form.getRawValue();
    const list: { field: Field; message: string }[] = [];
    if (!v.name.trim()) list.push({ field: 'name', message: NAME_MESSAGE });
    if (!EMAIL.test(v.email.trim())) list.push({ field: 'email', message: EMAIL_MESSAGE });
    return list;
  });
  protected readonly summary = computed<FormError[]>(() =>
    this.errors().map((e) => ({
      message: SUMMARY[e.field],
      fieldId:
        this.formFields()
          .find((f) => f.label() === LABELS[e.field])
          ?.controlId() ?? e.field,
    })),
  );

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected async rsvp(): Promise<void> {
    this.submitted.set(true);
    this.version.update((v) => v + 1);
    this.failure.set(null);
    if (this.errors().length || this.busy()) return;
    this.busy.set(true);
    const name = this.form.controls.name.value.trim();
    const email = this.form.controls.email.value.trim();
    try {
      await firstValueFrom(this.events.rsvpAsGuest(this.id(), { name, email }));
      this.confirmed.set({ firstName: name.split(/\s+/)[0], email });
    } catch (error) {
      this.failure.set(failure(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const event = await firstValueFrom(this.events.getPublicEvent(id));
      if (id !== this.id()) return;
      this.event.set(event);
      this.state.set('loaded');
    } catch (error) {
      if (id !== this.id()) return;
      // Members-only and unknown events are not public: members sign in to see them (L2-023 AC3).
      if (error instanceof HttpErrorResponse && error.status === 404) {
        await this.router.navigateByUrl(this.signInHref());
        return;
      }
      this.state.set('error');
    }
  }
}

function failure(error: unknown): { heading: string; text: string } {
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return {
      heading: 'Too many RSVPs from this connection',
      text: 'For everyone’s safety we take 10 an hour from one connection. Try again in an hour.',
    };
  }
  if (error instanceof HttpErrorResponse && error.status === 409) {
    return {
      heading: 'You’re not on the list',
      text: problemDetails(error)?.detail ?? 'This event isn’t taking RSVPs.',
    };
  }
  return {
    heading: 'We couldn’t save your RSVP',
    text: 'Something went wrong on our side. Your details are still here — try again.',
  };
}
