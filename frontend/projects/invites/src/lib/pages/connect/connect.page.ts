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
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  AUTH_SERVICE,
  CONNECT_SERVICE,
  ConnectLookupDto,
  ConnectOutcome,
  OrganisationNames,
} from '@faithtech-community/api';
import {
  AlertComponent,
  AuthLayoutComponent,
  ButtonComponent,
  CardComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  LinkComponent,
  PersonSummaryComponent,
  SkeletonComponent,
  StackComponent,
  TextFieldComponent,
  avatarColorFor,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type View =
  'loading' | 'unreachable' | 'invalid' | 'join' | 'sent' | 'connected' | 'pending' | 'own-code';
type Field = 'name' | 'email' | 'password';

const FIELDS: Field[] = ['name', 'email', 'password'];
const MIN_PASSWORD = 12;
// The profile editor's limit, so a new member can always save their name unchanged.
const MAX_NAME = 100;
// Loose check that matches the server's validator; the server is the authority.
const EMAIL = /^[^\s@]+@[^\s@]+$/;

const OUTCOME_VIEWS: Record<ConnectOutcome, View> = {
  Connected: 'connected',
  Pending: 'pending',
  OwnCode: 'own-code',
};

/**
 * The page a City Lead's QR code opens (L2-082, L2-083), matching docs/mocks/pages/connect: who the
 * visitor is connecting with, and sign-up with the L2-001 rules. A signed-in member is connected on
 * arrival (L2-082 AC4).
 */
@Component({
  selector: 'ft-connect-page',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    AlertComponent,
    AuthLayoutComponent,
    ButtonComponent,
    CardComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    LinkComponent,
    PersonSummaryComponent,
    SkeletonComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './connect.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly connect = inject(CONNECT_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);

  /** Route parameter: the secret from the QR code. */
  readonly token = input.required<string>();

  protected readonly lead = signal<ConnectLookupDto | null>(null);
  protected readonly notFound = signal(false);
  protected readonly unreachable = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly sentTo = signal<string | null>(null);
  protected readonly outcome = signal<ConnectOutcome | null>(null);
  protected readonly submitted = signal(false);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  // Re-evaluated on submit; the form's own state is not a signal.
  private readonly version = signal(0);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, maxTrimmedLength(MAX_NAME)]],
    email: ['', [Validators.required, Validators.pattern(EMAIL)]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD)]],
  });

  protected readonly view = computed<View>(() => {
    if (this.unreachable()) return 'unreachable';
    if (this.notFound()) return 'invalid';
    if (!this.lead()) return 'loading';
    const outcome = this.outcome();
    if (outcome) return OUTCOME_VIEWS[outcome];
    if (this.auth.isAuthenticated()) return 'loading';
    return this.sentTo() ? 'sent' : 'join';
  });
  protected readonly firstName = computed(() => this.lead()?.leadName.split(/\s+/)[0] ?? '');
  protected readonly meta = computed(() => {
    const lead = this.lead();
    return lead ? [lead.leadRole, lead.leadCity].filter(Boolean).join(' · ') : '';
  });
  protected readonly color = computed(() => avatarColorFor(this.lead()?.leadProfileId));
  protected readonly signInLink = computed(
    () => `/sign-in?returnUrl=${encodeURIComponent(`/meet/${this.token()}`)}`,
  );

  protected readonly errors = computed(() => {
    this.version();
    const server = this.serverErrors();
    return FIELDS.map((field) => ({
      field,
      message: server[field] ?? this.clientError(field),
    })).filter((e) => e.message !== '');
  });

  constructor() {
    effect(() => void this.load(this.token()));
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected summaryHeading(): string {
    const count = this.errors().length;
    return `Fix ${count} ${count === 1 ? 'thing' : 'things'} to create your account`;
  }

  protected retry(): void {
    void this.load(this.token());
  }

  protected async signUp(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.failed.set(false);
    this.version.update((v) => v + 1);
    if (this.form.invalid) {
      this.errorFocus()?.focusFirstError();
      return;
    }
    if (this.busy()) return;
    const { name, email, password } = this.form.getRawValue();
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.connect.signUp({
          token: this.token(),
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      );
      this.sentTo.set(email.trim());
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.notFound.set(true);
        return;
      }
      const fieldErrors = validationErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.failed.set(true);
      this.errorFocus()?.focusFirstError();
    } finally {
      this.busy.set(false);
    }
  }

  private clientError(field: Field): string {
    if (!this.submitted()) return '';
    const control = this.form.controls[field];
    if (control.hasError('required')) {
      return {
        name: 'Enter your name.',
        email: 'Enter your email address.',
        password: 'Enter a password.',
      }[field];
    }
    if (control.hasError('maxTrimmedLength')) {
      return `Use ${MAX_NAME} characters or fewer for your name.`;
    }
    if (control.hasError('pattern')) return 'Enter an email address like name@example.com.';
    if (control.hasError('minlength')) {
      return 'Use at least 12 characters. A short phrase is easiest to remember.';
    }
    return '';
  }

  private async load(token: string): Promise<void> {
    this.unreachable.set(false);
    this.notFound.set(false);
    try {
      const lead = await firstValueFrom(this.connect.lookUp(token));
      // A signed-in member is connected at once; a repeat changes nothing on the server.
      if (this.auth.isAuthenticated()) {
        this.outcome.set((await firstValueFrom(this.connect.connect(token))).outcome);
      }
      this.lead.set(lead);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) this.notFound.set(true);
      else this.unreachable.set(true);
    }
  }
}

/** Maps the API's validation problem details (PascalCase keys) onto the form's fields. */
function validationErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = key.toLowerCase() as Field;
    if (FIELDS.includes(field) && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}

/** Matches the server, which trims the name before checking its length. */
function maxTrimmedLength(max: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    control.value.trim().length > max ? { maxTrimmedLength: true } : null;
}
