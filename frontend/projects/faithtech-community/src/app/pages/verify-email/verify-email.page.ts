import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AUTH_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  AuthLayoutComponent,
  ButtonComponent,
  CardComponent,
  FormFieldComponent,
  LinkComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'pending' | 'verifying' | 'verified' | 'expired';
type Resend = { kind: 'sent'; email: string } | { kind: 'limited' } | { kind: 'failed' };

/** Verify an email from its link, or ask for a new link (L2-002), matching docs/mocks/pages/verify-email. */
@Component({
  selector: 'ft-verify-email-page',
  imports: [
    ReactiveFormsModule,
    AuthLayoutComponent,
    CardComponent,
    StackComponent,
    FormFieldComponent,
    TextFieldComponent,
    ButtonComponent,
    AlertComponent,
    LinkComponent,
  ],
  templateUrl: './verify-email.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPage implements OnInit {
  private readonly auth = inject(AUTH_SERVICE);

  readonly userId = input<string>();
  readonly token = input<string>();
  /** Set on a link that also makes an existing account a member of this organisation (L2-132 AC1). */
  readonly name = input<string>();
  readonly join = input<string>();
  /** The address the link went to, when the app knows it (after sign-up). */
  readonly email = input<string>();

  protected readonly state = signal<State>('pending');
  protected readonly sending = signal(false);
  protected readonly resend = signal<Resend | null>(null);
  protected readonly emailControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  /** The address to resend to without asking: from the link, or the signed-in member. */
  protected readonly knownEmail = computed(
    () => this.email() ?? this.auth.currentUser()?.email ?? null,
  );
  protected readonly firstName = computed(
    () => this.auth.currentUser()?.name?.split(' ')[0] ?? null,
  );

  async ngOnInit(): Promise<void> {
    const userId = this.userId();
    const token = this.token();
    if (!userId || !token) return;

    this.state.set('verifying');
    try {
      const name = this.name();
      const join = this.join();
      await firstValueFrom(
        this.auth.confirmEmail(userId, token, name && join ? { name, join } : undefined),
      );
      this.state.set('verified');
      if (this.auth.isAuthenticated()) await firstValueFrom(this.auth.loadCurrentUser());
    } catch {
      this.state.set('expired');
    }
  }

  protected async sendNewLink(): Promise<void> {
    const email = this.knownEmail() ?? this.emailControl.value.trim();
    if (!email) {
      this.emailControl.markAsTouched();
      return;
    }

    this.sending.set(true);
    try {
      await firstValueFrom(this.auth.resendVerification(email));
      this.resend.set({ kind: 'sent', email });
    } catch (error) {
      const limited = error instanceof HttpErrorResponse && error.status === 429;
      this.resend.set(limited ? { kind: 'limited' } : { kind: 'failed' });
    } finally {
      this.sending.set(false);
    }
  }

  protected emailError(): string {
    return this.emailControl.touched && this.emailControl.invalid
      ? 'Enter your email address.'
      : '';
  }
}
