import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  EVENT_TYPE_LABELS,
  EventDetailDto,
  EventFormat,
  EventRequest,
  EVENTS_SERVICE,
  EventType,
  EventVisibility,
  ORGANISATION_SERVICE,
  OrganisationNames,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorSummaryComponent,
  FormActionsComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  GridComponent,
  PageHeaderComponent,
  RadioComponent,
  RadioGroupComponent,
  SelectComponent,
  SelectOption,
  SkeletonComponent,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type Field =
  | 'title'
  | 'description'
  | 'type'
  | 'startsAt'
  | 'endsAt'
  | 'chapterId'
  | 'format'
  | 'venue'
  | 'onlineLink'
  | 'capacity'
  | 'visibility';
type State = 'loading' | 'loaded' | 'error';

const FIELDS: Field[] = [
  'title',
  'description',
  'type',
  'startsAt',
  'endsAt',
  'chapterId',
  'format',
  'venue',
  'onlineLink',
  'capacity',
  'visibility',
];

// The same words as the server's validator (SaveEventValidator); the server is the authority.
const MESSAGES = {
  title: 'Give the event a title people will recognise.',
  startsAt: 'Enter the date and time the event starts.',
  endsAt: 'The end time must be after the start time.',
  venue: 'Enter a venue address, or choose Online.',
  onlineLink: 'Enter the joining link, or choose In person.',
  capacity: 'Capacity must be at least 1, or leave it empty for no limit.',
};
// The error summary words the client-side errors as short links (docs/mocks/pages/event-form/invalid).
const SUMMARY: Record<string, string> = {
  [MESSAGES.title]: 'Enter a title',
  [MESSAGES.startsAt]: 'Enter a start',
  [MESSAGES.endsAt]: 'End must be after start',
  [MESSAGES.venue]: 'Enter a venue or choose Online',
  [MESSAGES.onlineLink]: 'Enter a joining link or choose In person',
  [MESSAGES.capacity]: 'Enter a capacity of at least 1',
};

const LABELS: Record<Field, string> = {
  title: 'Title',
  description: 'Description',
  type: 'Type',
  startsAt: 'Starts',
  endsAt: 'Ends',
  // The chapter picker is labelled with the organisation's singular label; see labelOf.
  chapterId: '',
  format: 'Format',
  venue: 'Venue address',
  onlineLink: 'Joining link',
  capacity: 'Capacity',
  visibility: 'Visibility',
};

const TYPE_OPTIONS: SelectOption[] = (Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(
  (value) => ({ value, label: EVENT_TYPE_LABELS[value] }),
);

/**
 * Create or edit an event (L2-020), matching docs/mocks/pages/event-form. Without `id` it publishes a
 * new event; with `id` it edits that one. Event Leads, City Leads and System Admins only; the API
 * answers 403 for anyone else.
 */
@Component({
  selector: 'ft-event-form-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormActionsComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    GridComponent,
    PageHeaderComponent,
    RadioComponent,
    RadioGroupComponent,
    SelectComponent,
    SkeletonComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './event-form.page.html',
  styleUrl: './event-form.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventFormPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly events = inject(EVENTS_SERVICE);
  private readonly organisations = inject(ORGANISATION_SERVICE);
  private readonly router = inject(Router);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);
  private readonly formFields = viewChildren(FormFieldComponent);

  /** Route parameter when editing. */
  readonly id = input<string>();

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly form = inject(NonNullableFormBuilder).group({
    title: [''],
    description: [''],
    type: ['Gathering' as EventType],
    startsAt: [''],
    endsAt: [''],
    chapterId: [''],
    format: ['InPerson' as EventFormat],
    venue: [''],
    onlineLink: [''],
    capacity: [''],
    visibility: ['Public' as EventVisibility],
  });
  private readonly format = toSignal(this.form.controls.format.valueChanges, {
    initialValue: this.form.controls.format.value,
  });
  protected readonly online = computed(() => this.format() === 'Online');
  protected readonly editing = computed(() => !!this.id());
  protected readonly heading = computed(() => (this.editing() ? 'Edit event' : 'New event'));
  protected readonly state = signal<State>('loaded');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly event = signal<EventDetailDto | null>(null);
  /** "{Organisation}-wide" and the chapters, or none while chapters are off (L2-141 AC2, L2-140 AC2). */
  protected readonly chapterOptions = signal<SelectOption[]>([]);
  protected readonly chapterLabel = computed(
    () => this.organisation.chapterLabel()?.singular ?? '',
  );
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  // Re-evaluated on submit; the form's own state is not a signal.
  private readonly version = signal(0);

  protected readonly errors = computed(() => {
    this.version();
    this.format();
    const server = this.serverErrors();
    return FIELDS.map((field) => ({
      field,
      message: server[field] ?? this.clientError(field),
    })).filter((e) => e.message !== '');
  });
  protected readonly summary = computed<FormError[]>(() =>
    this.errors().map((e) => ({
      message: SUMMARY[e.message] ?? e.message,
      fieldId:
        this.formFields()
          .find((f) => f.label() === this.labelOf(e.field))
          ?.controlId() ?? e.field,
    })),
  );
  protected readonly cancelHref = computed(() => (this.id() ? `/events/${this.id()}` : '/events'));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
      else void this.loadChapters(null);
    });
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected retry(): void {
    const id = this.id();
    if (id) void this.load(id);
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.failed.set(false);
    this.version.update((v) => v + 1);
    if (this.errors().length || this.busy()) {
      this.errorFocus()?.focusFirstError();
      return;
    }

    this.busy.set(true);
    try {
      const id = this.id();
      const request = this.request();
      const saved = id
        ? (await firstValueFrom(this.events.updateEvent(id, request)), id)
        : (await firstValueFrom(this.events.createEvent(request))).id;
      await this.router.navigateByUrl(`/events/${saved}`);
    } catch (error) {
      const fieldErrors = validationErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.failed.set(true);
      this.errorFocus()?.focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }

  private request(): EventRequest {
    const v = this.form.getRawValue();
    const online = v.format === 'Online';
    return {
      title: v.title.trim(),
      description: v.description.trim(),
      type: v.type,
      startsAt: new Date(v.startsAt).toISOString(),
      endsAt: new Date(v.endsAt).toISOString(),
      chapterId: v.chapterId || null,
      format: v.format,
      venue: online ? null : v.venue.trim(),
      onlineLink: online ? v.onlineLink.trim() : null,
      capacity: v.capacity.trim() ? Number(v.capacity) : null,
      visibility: v.visibility,
    };
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const event = await firstValueFrom(this.events.getEvent(id));
      this.event.set(event);
      void this.loadChapters(event);
      this.form.setValue({
        title: event.title,
        description: event.description,
        type: event.type,
        startsAt: toLocalInput(event.startsAt),
        endsAt: toLocalInput(event.endsAt),
        chapterId: event.chapterId ?? '',
        format: event.format,
        venue: event.venue ?? '',
        onlineLink: event.onlineLink ?? '',
        capacity: event.capacity === null ? '' : String(event.capacity),
        visibility: event.visibility,
      });
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }

  private labelOf(field: Field): string {
    return field === 'chapterId' ? this.chapterLabel() : LABELS[field];
  }

  /** The active chapters in order, plus the event's own if it was archived (L2-140 AC5). */
  private async loadChapters(event: EventDetailDto | null): Promise<void> {
    try {
      const organisation = await firstValueFrom(this.organisations.get());
      if (!organisation.chapterLabel) {
        this.chapterOptions.set([]);
        return;
      }
      const chapters = [...organisation.chapters];
      if (event?.chapterId && !chapters.some((c) => c.id === event.chapterId)) {
        chapters.push({ id: event.chapterId, name: event.chapterName ?? '' });
      }
      this.chapterOptions.set([
        { value: '', label: `${this.organisation.shortName()}-wide` },
        ...chapters.map((c) => ({ value: c.id, label: c.name })),
      ]);
    } catch {
      // Without the list the event stays organisation-wide, or keeps its chapter when edited.
      this.chapterOptions.set([]);
    }
  }

  private clientError(field: Field): string {
    if (!this.submitted()) return '';
    const v = this.form.getRawValue();
    const online = v.format === 'Online';
    switch (field) {
      case 'title':
        return v.title.trim() ? '' : MESSAGES.title;
      case 'startsAt':
        return v.startsAt ? '' : MESSAGES.startsAt;
      case 'endsAt':
        return v.startsAt && (!v.endsAt || v.endsAt <= v.startsAt) ? MESSAGES.endsAt : '';
      case 'venue':
        return !online && !v.venue.trim() ? MESSAGES.venue : '';
      case 'onlineLink':
        return online && !v.onlineLink.trim() ? MESSAGES.onlineLink : '';
      case 'capacity': {
        const text = v.capacity.trim();
        return !text || (Number.isInteger(Number(text)) && Number(text) >= 1)
          ? ''
          : MESSAGES.capacity;
      }
      default:
        return '';
    }
  }
}

/** "2026-11-06T18:30" in local time, the value a datetime-local input takes. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Maps the API's validation problem details (PascalCase keys) onto the form's fields. */
function validationErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = FIELDS.find((f) => f.toLowerCase() === key.toLowerCase());
    if (field && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
