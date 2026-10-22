import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  AUTH_SERVICE,
  BROWSER_REDIRECT,
  SignUpFieldErrors,
  signUpFieldErrors,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BenefitComponent,
  ButtonComponent,
  CardComponent,
  ContainerComponent,
  CtaBandComponent,
  EmptyStateComponent,
  GridComponent,
  LandingHeroComponent,
  LinkComponent,
  SignInCredentials,
  SignInFormComponent,
  SignInFormFailure,
  SignUpDetails,
  SignUpFormComponent,
  VideoPlayerComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { COMMUNITY_ORIGIN } from '../community-origin';

const BROCHURE_TRANSCRIPT =
  'FaithTech is a community of Christians who build with technology. ' +
  'Find the builders, leads and volunteers in your city. ' +
  'RSVP to builders nights and hackathons, and bring a friend. ' +
  'Work together on projects that serve your neighbours. ' +
  'Join FaithTech Community. It’s free, and it takes a minute.';

/**
 * The marketing page (L2-055), matching docs/mocks/pages/marketing. It collects credentials and
 * hands the session to the community app, which completes PKCE (ADR 0017).
 */
@Component({
  selector: 'ft-landing-page',
  imports: [
    AlertComponent,
    BenefitComponent,
    ButtonComponent,
    CardComponent,
    ContainerComponent,
    CtaBandComponent,
    EmptyStateComponent,
    GridComponent,
    LandingHeroComponent,
    LinkComponent,
    SignInFormComponent,
    SignUpFormComponent,
    VideoPlayerComponent,
  ],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly redirect = inject(BROWSER_REDIRECT);
  protected readonly communityOrigin = inject(COMMUNITY_ORIGIN);

  /** The community app page to land on after signing in (`?returnUrl=/events`). */
  readonly returnUrl = input<string>();
  /** Present (`?join`) when the panel shows the sign-up form. */
  readonly join = input<string>();
  /** How Google sign-in ended when the API sent the visitor back (`?google=failed|suspended`). */
  readonly google = input<string>();

  /** The brochure's narration (eng/videos/brochure/script.md), shown as its transcript. */
  protected readonly transcript = BROCHURE_TRANSCRIPT;
  protected readonly joining = computed(() => this.join() !== undefined);
  protected readonly busy = signal(false);
  protected readonly failure = signal<SignInFormFailure | null>(null);
  /** Set once the API has accepted the credentials, while the browser moves to the community app. */
  protected readonly handingOff = signal<{ emailVerified: boolean } | null>(null);
  protected readonly unreachable = signal(false);
  protected readonly serverErrors = signal<SignUpFieldErrors>({});
  protected readonly sentTo = signal<string | null>(null);
  protected readonly googleBusy = signal(false);
  private readonly panelHeading = viewChild<ElementRef<HTMLElement>>('panelHeading');
  private readonly signInForm = viewChild(SignInFormComponent);

  constructor() {
    const injector = inject(Injector);
    // The API's Google outcome arrives once, in the URL the visitor comes back to (ADR 0018).
    effect(() => {
      const outcome = this.google();
      untracked(() => {
        if (outcome === 'suspended') this.failure.set('suspended');
        else if (outcome === 'failed') this.failure.set('google_failed');
      });
    });
    let first = true;
    // Join now and Sign in switch the panel in place: take the visitor to its heading.
    effect(() => {
      this.joining();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.failure.set(null));
      afterNextRender(() => this.panelHeading()?.nativeElement.focus(), { injector });
    });
  }

  protected show(form: 'join' | 'sign-in'): void {
    const join = form === 'join' ? '' : null;
    void this.router.navigate([], { queryParams: { join }, queryParamsHandling: 'merge' });
  }

  ngOnInit(): void {
    // A member whose session the community app keeps on this device goes straight there (L2-055 AC6).
    if (this.auth.hasKeptSession()) {
      this.handingOff.set({ emailVerified: true });
      this.redirect(`${this.communityOrigin}${appPath(this.returnUrl())}`);
    }
  }

  /** One flow for "Sign in with Google" and "Sign up with Google": the browser leaves for Google. */
  protected continueWithGoogle(): void {
    if (this.googleBusy()) return;
    this.googleBusy.set(true);
    this.auth.signInWithGoogle(
      appPath(this.returnUrl()),
      this.signInForm()?.keepSignedIn() ?? false,
    );
  }

  protected verifyEmailLink(email: string): string {
    return `${this.communityOrigin}/verify-email?email=${encodeURIComponent(email)}`;
  }

  protected async signUp(request: SignUpDetails): Promise<void> {
    if (this.busy()) return;
    this.serverErrors.set({});
    this.unreachable.set(false);
    this.busy.set(true);
    try {
      await firstValueFrom(this.auth.signUp(request));
      this.sentTo.set(request.email);
    } catch (error) {
      const fieldErrors = signUpFieldErrors(error);
      if (fieldErrors) this.serverErrors.set(fieldErrors);
      else this.unreachable.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected async signIn({ email, password, keepSignedIn }: SignInCredentials): Promise<void> {
    if (this.busy()) return;
    this.failure.set(null);
    this.busy.set(true);
    try {
      const outcome = await firstValueFrom(this.auth.signInWithPassword(email, password));
      if (!outcome.succeeded) {
        this.failure.set(outcome.error);
        return;
      }
      this.handingOff.set({ emailVerified: outcome.emailVerified });
      this.redirect(this.continueUrl(keepSignedIn));
    } catch {
      this.failure.set('unreachable');
    } finally {
      this.busy.set(false);
    }
  }

  /** The community app's /auth/continue, which starts PKCE against the session just created. */
  private continueUrl(keepSignedIn: boolean): string {
    const query = new URLSearchParams({
      returnUrl: appPath(this.returnUrl()),
      keepSignedIn: keepSignedIn ? '1' : '0',
    });
    return `${this.communityOrigin}/auth/continue?${query}`;
  }
}

/** Only a path inside the community app is carried; anything else lands on home. */
function appPath(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}
