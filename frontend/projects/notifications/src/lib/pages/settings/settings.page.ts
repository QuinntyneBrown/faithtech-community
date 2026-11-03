import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormControl,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  ACCOUNT_SERVICE,
  ANNOUNCEMENTS_SERVICE,
  AUTH_SERVICE,
  OrganisationNames,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  DangerZoneComponent,
  DialogService,
  ErrorSummaryComponent,
  FormActionsComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  IconComponent,
  InlineMessageComponent,
  PageHeaderComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  SwitchComponent,
  TextFieldComponent,
  ThemePreference,
  ThemeService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  SIGN_OUT_EVERYWHERE_FOCUS,
  SignOutEverywhereDialog,
} from '../../dialogs/sign-out-everywhere';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
type Field = 'email' | 'currentPassword' | 'newPassword';

const MIN_PASSWORD = 12;
const FIELDS: Field[] = ['email', 'currentPassword', 'newPassword'];
/** The error summary words each error as a short link (docs/mocks/pages/settings/invalid). */
const SUMMARY: Record<string, string> = {
  'Enter your current password to change it.': 'Enter your current password',
};

/**
 * Settings (mock `pages/settings`). The Account card changes the sign-in email, which a link sent to the new
 * address confirms, and the password, which needs the current one (L2-052 AC1-2); "Save settings" saves it.
 * Appearance applies the chosen theme at once and remembers it on this device (L2-045 AC6). "Email me
 * announcements" saves the announcement email opt-out when it is flipped (L2-030 AC2, ADR 0016). "Sign out
 * everywhere" confirms in a dialog, then ends every session and signs this browser out (L2-052 AC3).
 */
@Component({
  selector: 'ft-settings-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    DangerZoneComponent,
    ErrorSummaryComponent,
    FormActionsComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    IconComponent,
    InlineMessageComponent,
    PageHeaderComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
    SwitchComponent,
    TextFieldComponent,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly theme = inject(ThemeService);
  private readonly announcements = inject(ANNOUNCEMENTS_SERVICE);
  private readonly accounts = inject(ACCOUNT_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);
  private readonly emailField = viewChild.required('emailField', { read: FormFieldComponent });
  private readonly currentField = viewChild.required('currentField', { read: FormFieldComponent });
  private readonly newField = viewChild.required('newField', { read: FormFieldComponent });

  protected readonly preference = this.theme.preference;
  /** "Email me announcements" is on while the member has not opted out; disabled until it is read. */
  protected readonly emailAnnouncements = new FormControl(
    { value: true, disabled: true },
    { nonNullable: true },
  );
  protected readonly save = signal<SaveState>('idle');

  protected readonly account = inject(NonNullableFormBuilder).group({
    email: '',
    currentPassword: '',
    newPassword: '',
  });
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly busy = signal(false);
  protected readonly accountFailed = signal(false);
  /** The success alert's text once the Account card saved, naming what changed. */
  protected readonly accountSaved = signal<string | null>(null);
  protected readonly summary = computed<FormError[]>(() =>
    FIELDS.flatMap((field) => {
      const message = this.errors()[field];
      return message
        ? [{ message: SUMMARY[message] ?? message, fieldId: this.fieldId(field) }]
        : [];
    }),
  );

  /** The email the account signs in with, as last read; it changes only when the link is opened. */
  private savedEmail = '';

  constructor() {
    this.emailAnnouncements.valueChanges.subscribe((on) => void this.setEmailAnnouncements(on));
    void this.loadAccount();
    void this.load();
  }

  protected error(field: Field): string {
    return this.errors()[field] ?? '';
  }

  protected choose(preference: ThemePreference): void {
    this.theme.set(preference);
  }

  protected async saveAccount(): Promise<void> {
    if (this.busy()) return;
    const { email, currentPassword, newPassword } = this.account.getRawValue();
    this.accountSaved.set(null);
    this.accountFailed.set(false);
    this.errors.set(validate(email.trim(), currentPassword, newPassword));
    if (this.summary().length) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    try {
      const updated = await firstValueFrom(
        this.accounts.update({
          email: email.trim(),
          ...(newPassword ? { currentPassword, newPassword } : {}),
        }),
      );
      this.account.patchValue({ email: this.savedEmail, currentPassword: '', newPassword: '' });
      this.accountSaved.set(savedText(updated.pendingEmail, updated.passwordChanged));
    } catch (error) {
      const errors = fieldErrors(error);
      if (errors) {
        this.errors.set(errors);
        this.errorFocus().focusFirstError();
      } else {
        this.accountFailed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async signOutEverywhere(): Promise<void> {
    const ref = this.dialogs.open<boolean>(SignOutEverywhereDialog, {
      autoFocus: SIGN_OUT_EVERYWHERE_FOCUS,
    });
    if (!(await firstValueFrom(ref.closed))) return;
    // Every token is already revoked, so this browser's own sign-out may be refused; it still leaves.
    await firstValueFrom(this.auth.signOut()).catch(() => undefined);
  }

  private fieldId(field: Field): string {
    const formField =
      field === 'email'
        ? this.emailField()
        : field === 'currentPassword'
          ? this.currentField()
          : this.newField();
    return formField.controlId();
  }

  private async setEmailAnnouncements(on: boolean): Promise<void> {
    this.save.set('saving');
    try {
      await firstValueFrom(this.announcements.setEmailOptOut(!on));
      this.save.set('saved');
    } catch {
      this.emailAnnouncements.setValue(!on, { emitEvent: false });
      this.save.set('failed');
    }
  }

  private async load(): Promise<void> {
    try {
      const optedOut = await firstValueFrom(this.announcements.getEmailOptOut());
      this.emailAnnouncements.setValue(!optedOut, { emitEvent: false });
    } catch {
      // The switch shows the default; flipping it still saves the member's choice.
    }
    this.emailAnnouncements.enable({ emitEvent: false });
  }

  private async loadAccount(): Promise<void> {
    try {
      this.savedEmail = (await firstValueFrom(this.accounts.get())).email;
    } catch {
      // Fall back to the signed-in member's email, which /api/me already gave.
      this.savedEmail = this.auth.currentUser()?.email ?? '';
    }
    this.account.patchValue({ email: this.savedEmail });
  }
}

function validate(
  email: string,
  currentPassword: string,
  newPassword: string,
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!email) errors.email = 'Enter your email address.';
  else if (!/^[^@\s]+@[^@\s]+$/.test(email))
    errors.email = 'Enter an email address like name@example.com.';
  if (newPassword && !currentPassword)
    errors.currentPassword = 'Enter your current password to change it.';
  if (newPassword && newPassword.length < MIN_PASSWORD)
    errors.newPassword = 'Use at least 12 characters.';
  return errors;
}

/** Maps the API's validation problem details (PascalCase keys) onto the Account fields. */
function fieldErrors(error: unknown): Partial<Record<Field, string>> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: Partial<Record<Field, string>> = {};
  for (const field of FIELDS) {
    const key = field[0].toUpperCase() + field.slice(1);
    if (errors[key]?.length) mapped[field] = errors[key][0];
  }
  return Object.keys(mapped).length ? mapped : null;
}

function savedText(pendingEmail: string | null, passwordChanged: boolean): string {
  const parts: string[] = [];
  if (pendingEmail) {
    parts.push(
      `We sent a link to ${pendingEmail}. Keep signing in with your current email until you open it.`,
    );
  }
  if (passwordChanged) parts.push('Your new password works from your next sign-in.');
  return parts.length ? parts.join(' ') : 'Your account is unchanged.';
}
