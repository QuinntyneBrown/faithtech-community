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
import {
  ANNOUNCEMENTS_SERVICE,
  AnnouncementAudience,
  AnnouncementSent,
  ROLE_LABELS,
  ROLES,
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
  StackComponent,
  SwitchComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { distinctUntilChanged, firstValueFrom, map, startWith } from 'rxjs';

type Field = 'subject' | 'body' | 'roles';

const MESSAGES: Record<Field, string> = {
  subject: 'Add a subject so people know what it’s about.',
  body: 'Write a message of at least one sentence.',
  roles: 'Choose at least one role.',
};
/** Server field names (FluentValidation) to the page's fields. */
const SERVER_FIELDS: Record<string, Field> = {
  Subject: 'subject',
  Body: 'body',
  'Audience.Roles': 'roles',
};

/** Compose and send an announcement (L2-029), matching docs/mocks/pages/compose-announcement. */
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
  private readonly errorFocus = viewChild(FormErrorFocusDirective);
  private readonly subjectField = viewChild('subjectField', { read: FormFieldComponent });
  private readonly bodyField = viewChild('bodyField', { read: FormFieldComponent });

  protected readonly roles = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

  protected readonly form = inject(NonNullableFormBuilder).group({
    kind: ['Everyone' as 'Everyone' | 'Roles'],
    roles: [[] as Role[]],
    subject: [''],
    body: [''],
    alsoEmail: [true],
  });

  private readonly audience = toSignal(
    this.form.valueChanges.pipe(map(() => this.audienceOf(this.form.getRawValue()))),
    { initialValue: { kind: 'Everyone' } as AnnouncementAudience },
  );
  protected readonly byRole = computed(() => this.audience().kind === 'Roles');

  protected readonly everyoneCount = signal<number | null>(null);
  protected readonly recipientCount = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly sent = signal<(AnnouncementSent & { alsoEmail: boolean }) | null>(null);
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  // Re-evaluated on submit; the form's own state is not a signal.
  private readonly version = signal(0);
  private countRequest = 0;

  protected readonly errors = computed(() => {
    this.version();
    this.audience();
    const server = this.serverErrors();
    return (['roles', 'subject', 'body'] as Field[])
      .map((field) => ({ field, message: server[field] ?? this.clientError(field) }))
      .filter((e) => e.message !== '');
  });

  protected readonly summary = computed<FormError[]>(() =>
    this.errors().map((e) => ({ message: e.message, fieldId: this.fieldOf(e.field) })),
  );

  protected readonly sendLabel = computed(() => {
    const count = this.recipientCount();
    if (count === null) return 'Send';
    return `Send to ${count} ${count === 1 ? 'person' : 'people'}`;
  });

  /** "It’s in their notifications now. 38 will also get it by email — 3 have opted out…" */
  protected readonly sentSummary = computed(() => {
    const done = this.sent();
    if (!done) return '';
    const inApp = 'It’s in their notifications now.';
    if (!done.alsoEmail) return inApp;
    const optedOut = done.recipientCount - done.emailCount;
    return optedOut > 0
      ? `${inApp} ${done.emailCount} will also get it by email — ${optedOut} ${optedOut === 1 ? 'has' : 'have'} opted out of announcement emails.`
      : `${inApp} ${done.emailCount} will also get it by email.`;
  });

  constructor() {
    void firstValueFrom(this.announcements.countRecipients({ kind: 'Everyone' })).then(
      (count) => this.everyoneCount.set(count),
      () => undefined,
    );
    // The count follows the chosen audience (L2-029 AC4); only the latest answer counts.
    this.form.valueChanges
      .pipe(
        map(() => JSON.stringify(this.audienceOf(this.form.getRawValue()))),
        startWith(JSON.stringify({ kind: 'Everyone' })),
        distinctUntilChanged(),
      )
      .subscribe((key) => void this.count(JSON.parse(key) as AnnouncementAudience));
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected writeAnother(): void {
    this.form.reset();
    this.submitted.set(false);
    this.serverErrors.set({});
    this.sent.set(null);
  }

  protected async send(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.failed.set(false);
    this.version.update((v) => v + 1);
    if (this.errors().length || this.busy()) {
      this.errorFocus()?.focusFirstError();
      return;
    }

    const value = this.form.getRawValue();
    this.busy.set(true);
    try {
      const sent = await firstValueFrom(
        this.announcements.send({
          subject: value.subject.trim(),
          body: value.body.trim(),
          audience: this.audienceOf(value),
          alsoEmail: value.alsoEmail,
        }),
      );
      this.sent.set({ ...sent, alsoEmail: value.alsoEmail });
    } catch (error) {
      const fieldErrors = serverFieldErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.failed.set(true);
      this.errorFocus()?.focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }

  private async count(audience: AnnouncementAudience): Promise<void> {
    const request = ++this.countRequest;
    if (audience.kind === 'Roles' && !audience.roles?.length) {
      this.recipientCount.set(0);
      return;
    }
    try {
      const count = await firstValueFrom(this.announcements.countRecipients(audience));
      if (request === this.countRequest) this.recipientCount.set(count);
    } catch {
      if (request === this.countRequest) this.recipientCount.set(null);
    }
  }

  private audienceOf(value: { kind: string; roles: Role[] }): AnnouncementAudience {
    // Keep the roles in the order the page lists them.
    return value.kind === 'Roles'
      ? { kind: 'Roles', roles: ROLES.filter((r) => value.roles.includes(r)) }
      : { kind: 'Everyone' };
  }

  private clientError(field: Field): string {
    if (!this.submitted()) return '';
    const value = this.form.getRawValue();
    if (field === 'roles') {
      return value.kind === 'Roles' && !value.roles.length ? MESSAGES.roles : '';
    }
    return value[field].trim() === '' ? MESSAGES[field] : '';
  }

  private fieldOf(field: Field): string {
    if (field === 'roles') return 'an-roles';
    return (field === 'subject' ? this.subjectField() : this.bodyField())?.controlId() ?? '';
  }
}

function serverFieldErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = SERVER_FIELDS[key];
    if (field && messages[0]) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
