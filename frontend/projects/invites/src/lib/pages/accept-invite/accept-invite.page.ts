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
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AUTH_SERVICE,
  InviteLookupDto,
  INVITES_SERVICE,
  OrganisationNames,
  problemDetails,
  ROLE_LABELS,
} from '@faithtech-community/api';
import {
  AlertComponent,
  AuthLayoutComponent,
  AvatarComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  EmptyStateComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  SkeletonComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type View =
  'loading' | 'unreachable' | 'invalid' | 'join' | 'sign-in' | 'existing' | 'wrong-account';
type Field = 'name' | 'password';

const MAX_NAME = 100;

const MIN_PASSWORD = 12;

const STALE: Record<string, { heading: string; text: (inviter: string) => string }> = {
  Expired: {
    heading: 'This invite has expired',
    text: (inviter) =>
      `Invites last 14 days. Ask ${inviter} to send a new one, or create an account yourself — anyone can join.`,
  },
  Accepted: {
    heading: 'This invite has already been used',
    text: () =>
      'Invites can be used once. Sign in if it was you, or create an account yourself — anyone can join.',
  },
  Revoked: {
    heading: 'This invite was withdrawn',
    text: (inviter) =>
      `Ask ${inviter} if you should have a new one, or create an account yourself — anyone can join.`,
  },
  Unknown: {
    heading: 'This invite link isn’t valid',
    text: () => 'Check the link in your email, or create an account yourself — anyone can join.',
  },
};

/** Accept an emailed invite (L2-011), matching docs/mocks/pages/accept-invite. */
@Component({
  selector: 'ft-accept-invite-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AuthLayoutComponent,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ClusterComponent,
    EmptyStateComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    SkeletonComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './accept-invite.page.html',
  styleUrl: './accept-invite.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptInvitePage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly invites = inject(INVITES_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly router = inject(Router);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);

  /** Route parameter: the secret from the invite link. */
  readonly token = input.required<string>();

  protected readonly invite = signal<InviteLookupDto | null>(null);
  protected readonly notFound = signal(false);
  protected readonly unreachable = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly submitted = signal(false);
  private readonly serverErrors = signal<Partial<Record<Field, string>>>({});
  private readonly version = signal(0);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [''],
    email: [''],
    password: [''],
  });

  protected readonly signedInEmail = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly view = computed<View>(() => {
    if (this.unreachable()) return 'unreachable';
    if (this.notFound()) return 'invalid';
    const invite = this.invite();
    if (!invite) return 'loading';
    if (invite.status !== 'Pending') return 'invalid';
    if (this.auth.isAuthenticated()) {
      return sameEmail(this.signedInEmail(), invite.email) ? 'existing' : 'wrong-account';
    }
    return invite.hasAccount ? 'sign-in' : 'join';
  });
  protected readonly stale = computed(
    () => STALE[this.invite()?.status ?? 'Unknown'] ?? STALE['Unknown'],
  );
  protected readonly staleText = computed(() =>
    this.stale().text(this.invite()?.inviterName ?? 'the lead who invited you'),
  );
  protected readonly roleLabel = computed(() => {
    const role = this.invite()?.preassignedRole;
    return role ? ROLE_LABELS[role] : null;
  });
  protected readonly where = computed(() => {
    const city = this.invite()?.inviterChapterName;
    return city ? `${this.organisation.shortName()} ${city}` : this.organisation.shortName();
  });

  protected readonly errors = computed(() => {
    this.version();
    const server = this.serverErrors();
    return (['name', 'password'] as Field[])
      .map((field) => ({ field, message: server[field] ?? this.clientError(field) }))
      .filter((e) => e.message !== '');
  });

  constructor() {
    effect(() => void this.load(this.token()));
  }

  protected error(field: Field): string {
    return this.errors().find((e) => e.field === field)?.message ?? '';
  }

  protected summaryHeading(): string {
    const count = this.errors().length;
    return `Fix ${count} ${count === 1 ? 'thing' : 'things'} to accept the invite`;
  }

  protected retry(): void {
    void this.load(this.token());
  }

  protected signInToAccept(): void {
    void this.auth.signIn(`/accept-invite/${this.token()}`);
  }

  protected async join(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.failed.set(false);
    this.version.update((v) => v + 1);
    if (this.errors().length) {
      this.errorFocus()?.focusFirstError();
      return;
    }
    if (this.busy()) return;
    const { name, password } = this.form.getRawValue();
    const email = this.invite()!.email;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.invites.acceptInvite(this.token(), { name: name.trim(), password }),
      );
      await firstValueFrom(this.auth.signInWithPassword(email, password));
      await this.auth.signIn('/people/me');
    } catch (error) {
      await this.handleFailure(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async accept(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.invites.acceptInvite(this.token()));
      await this.router.navigateByUrl('/people/me');
    } catch (error) {
      await this.handleFailure(error);
    } finally {
      this.busy.set(false);
    }
  }

  private async handleFailure(error: unknown): Promise<void> {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      const errors = problemDetails(error)?.errors ?? {};
      this.serverErrors.set({ name: errors['Name']?.[0], password: errors['Password']?.[0] });
      this.errorFocus()?.focusFirstError();
    } else if (error instanceof HttpErrorResponse && error.status === 409) {
      // The invite changed since the page loaded (used, expired or withdrawn): show its new state.
      await this.load(this.token());
    } else {
      this.failed.set(true);
    }
  }

  private clientError(field: Field): string {
    if (!this.submitted()) return '';
    const value = this.form.controls[field].value;
    if (field === 'name') {
      if (!value.trim()) return 'Enter your name.';
      // The profile editor's limit, so a new member can always save their name unchanged.
      return value.trim().length > MAX_NAME
        ? `Use ${MAX_NAME} characters or fewer for your name.`
        : '';
    }
    if (!value) return 'Create a password.';
    return value.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : '';
  }

  private async load(token: string): Promise<void> {
    this.unreachable.set(false);
    this.notFound.set(false);
    try {
      const invite = await firstValueFrom(this.invites.getInvite(token));
      this.form.controls.email.setValue(invite.email);
      this.invite.set(invite);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) this.notFound.set(true);
      else this.unreachable.set(true);
    }
  }
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
