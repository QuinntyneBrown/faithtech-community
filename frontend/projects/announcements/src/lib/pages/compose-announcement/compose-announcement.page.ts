import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ANNOUNCEMENTS_SERVICE,
  AUTH_SERVICE,
  AnnouncementAudience,
  AnnouncementSent,
  AudienceKind,
  EVENTS_SERVICE,
  EventSummaryDto,
  ROLES,
  ROLE_LABELS,
  Role,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  ClusterComponent,
  ErrorSummaryComponent,
  FormActionsComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  IconComponent,
  PageHeaderComponent,
  RadioComponent,
  RadioGroupComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
  SwitchComponent,
  TextFieldComponent,
  TextareaComponent,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type Field = 'subject' | 'body' | 'roles' | 'eventId';

const SUBJECT_MESSAGE = 'Add a subject so people know what it’s about.';
const BODY_MESSAGE = 'Write a message of at least one sentence.';
const ROLES_MESSAGE = 'Choose at least one role.';
const EVENT_MESSAGE = 'Choose an event.';
// The error summary words the errors as short links (docs/mocks/pages/compose-announcement/invalid).
const SUMMARY: Record<string, string> = {
  [SUBJECT_MESSAGE]: 'Add a subject',
  [BODY_MESSAGE]: 'Write a message',
};
const SENDERS: Role[] = ['CommunicationsLead', 'SystemAdmin'];

/**
 * Compose and send an announcement (L2-029, mock `pages/compose-announcement`). The send button shows how
 * many people the chosen audience reaches; Communications Leads and System Admins only (ADR 0015).
 */
@Component({
  selector: 'ft-compose-announcement-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    ClusterComponent,
    ErrorSummaryComponent,
    FormActionsComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    IconComponent,
    PageHeaderComponent,
    RadioComponent,
    RadioGroupComponent,
    SelectComponent,
    StackComponent,
    SwitchComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './compose-announcement.page.html',
  styleUrl: './compose-announcement.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposeAnnouncementPage {
  private readonly announcements = inject(ANNOUNCEMENTS_SERVICE);
  private readonly events = inject(EVENTS_SERVICE);
  private readonly router = inject(Router);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);
  private readonly subjectField = viewChild('subjectField', { read: FormFieldComponent });
  private readonly bodyField = viewChild('bodyField', { read: FormFieldComponent });

  protected readonly roles = ROLES.map((role) => ({ role, label: ROLE_LABELS[role] }));
  protected readonly form = inject(NonNullableFormBuilder).group({
    kind: ['Everyone' as AudienceKind],
    roles: [[] as string[]],
    eventId: [''],
    subject: [''],
    body: [''],
    alsoEmail: [true],
  });

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly sent = signal<AnnouncementSent | null>(null);
  private readonly sentByEmail = signal(false);
  protected readonly everyone = signal<number | null>(null);
  protected readonly count = signal<number | null>(null);
  protected readonly upcoming = signal<EventSummaryDto[]>([]);
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  private countRequest = 0;

  protected readonly kind = computed(() => this.value().kind ?? 'Everyone');
  protected readonly eventOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Choose an event' },
    ...this.upcoming().map((e) => ({
      value: e.id,
      label: `${e.title} · ${formatDay(e.startsAt)}`,
    })),
  ]);
  protected readonly errors = computed(() => {
    const value = this.value();
    const server = this.serverErrors();
    const client: Record<Field, string> = {
      subject: value.subject?.trim() ? '' : SUBJECT_MESSAGE,
      body: value.body?.trim() ? '' : BODY_MESSAGE,
      roles: value.kind === 'Roles' && !value.roles?.length ? ROLES_MESSAGE : '',
      eventId: value.kind === 'EventRsvps' && !value.eventId ? EVENT_MESSAGE : '',
    };
    return (['subject', 'body', 'roles', 'eventId'] as Field[])
      .map((field) => ({
        field,
        message: server[field] ?? (this.submitted() ? client[field] : ''),
      }))
      .filter((e) => e.message !== '');
  });
  protected readonly summary = computed<FormError[]>(() =>
    this.errors()
      .filter((e) => e.field === 'subject' || e.field === 'body')
      .map((e) => ({ message: SUMMARY[e.message] ?? e.message, fieldId: this.fieldId(e.field) })),
  );
  protected readonly sendLabel = computed(() => {
    if (this.busy()) return 'Sending…';
    const count = this.count();
    return count === null ? 'Send' : `Send to ${count} ${count === 1 ? 'person' : 'people'}`;
  });
  protected readonly sentHeading = computed(() => {
    const count = this.sent()?.recipientCount ?? 0;
    return `Sent to ${count} ${count === 1 ? 'person' : 'people'}`;
  });
  /** "38 will also get it by email — 3 have opted out of announcement emails." when it went by email. */
  protected readonly emailLine = computed(() => {
    const sent = this.sent();
    if (!sent || !this.sentByEmail()) return '';
    const optedOut = sent.recipientCount - sent.emailCount;
    const reason =
      optedOut > 0
        ? ` — ${optedOut} ${optedOut === 1 ? 'has' : 'have'} opted out of announcement emails`
        : '';
    return ` ${sent.emailCount} will also get it by email${reason}.`;
  });

  constructor() {
    if (
      !inject(AUTH_SERVICE)
        .roles()
        .some((r) => SENDERS.includes(r))
    ) {
      void this.router.navigateByUrl('/forbidden');
      return;
    }
    this.form.controls.kind.valueChanges.subscribe((kind) => {
      if (kind === 'EventRsvps' && this.upcoming().length === 0) void this.loadEvents();
    });
    this.form.valueChanges.subscribe(() => {
      this.serverErrors.set({});
      void this.recount();
    });
    void this.loadEveryone();
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected async send(): Promise<void> {
    this.submitted.set(true);
    this.failed.set(false);
    if (this.errors().length || this.busy()) {
      this.errorFocus()?.focusFirstError();
      return;
    }

    this.busy.set(true);
    const value = this.form.getRawValue();
    try {
      this.sentByEmail.set(value.alsoEmail);
      this.sent.set(
        await firstValueFrom(
          this.announcements.send({
            subject: value.subject.trim(),
            body: value.body.trim(),
            alsoEmail: value.alsoEmail,
            audience: this.audience(),
          }),
        ),
      );
    } catch (error) {
      const fieldErrors = validationErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.failed.set(true);
      this.errorFocus()?.focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }

  protected writeAnother(): void {
    this.sent.set(null);
    this.submitted.set(false);
    this.form.reset();
  }

  private audience(): AnnouncementAudience {
    const value = this.form.getRawValue();
    if (value.kind === 'Roles') return { kind: 'Roles', roles: value.roles as Role[] };
    if (value.kind === 'EventRsvps') return { kind: 'EventRsvps', eventId: value.eventId };
    return { kind: 'Everyone' };
  }

  /** The count for the audience as chosen so far; none until a role or an event is picked. */
  private async recount(): Promise<void> {
    const request = ++this.countRequest;
    const audience = this.audience();
    const incomplete =
      (audience.kind === 'Roles' && !audience.roles?.length) ||
      (audience.kind === 'EventRsvps' && !audience.eventId);
    if (audience.kind === 'Everyone' && this.everyone() !== null) {
      this.count.set(this.everyone());
      return;
    }
    if (incomplete) {
      this.count.set(null);
      return;
    }
    try {
      const count = await firstValueFrom(this.announcements.countRecipients(audience));
      if (request === this.countRequest) this.count.set(count);
    } catch {
      if (request === this.countRequest) this.count.set(null);
    }
  }

  private async loadEveryone(): Promise<void> {
    try {
      const count = await firstValueFrom(this.announcements.countRecipients({ kind: 'Everyone' }));
      this.everyone.set(count);
      if (this.kind() === 'Everyone') this.count.set(count);
    } catch {
      // The count is a preview; sending still works without it.
    }
  }

  private async loadEvents(): Promise<void> {
    try {
      const list = await firstValueFrom(this.events.listEvents({ filter: 'Upcoming' }));
      this.upcoming.set(list.events.filter((e) => !e.isCancelled));
    } catch {
      this.upcoming.set([]);
    }
  }

  private fieldId(field: Field): string {
    const formField = field === 'subject' ? this.subjectField() : this.bodyField();
    return formField?.controlId() ?? '';
  }
}

/** Maps the API's validation problem details (PascalCase keys, nested "Audience.Roles") onto the form. */
function validationErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const fields: Record<string, Field> = {
    subject: 'subject',
    body: 'body',
    'audience.roles': 'roles',
    'audience.eventid': 'eventId',
  };
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = fields[key.toLowerCase()];
    if (field && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
