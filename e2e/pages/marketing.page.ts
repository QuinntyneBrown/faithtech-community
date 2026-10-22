import { Locator, Page } from '@playwright/test';

import { fieldError } from './sign-in.page';

/** The marketing app's own dev server (playwright.config.ts starts it next to the community app). */
export const MARKETING_URL = process.env['E2E_MARKETING_URL'] ?? 'http://localhost:4300';

/** The public marketing page at www.faithtech.community (docs/mocks/pages/marketing). */
export class MarketingPage {
  readonly heading: Locator;
  readonly eyebrow: Locator;
  readonly lead: Locator;
  readonly topBar: Locator;
  readonly topBarJoin: Locator;
  readonly topBarSignIn: Locator;
  readonly benefitsHeading: Locator;
  readonly benefits: Locator;
  readonly callToAction: Locator;
  readonly callToActionJoin: Locator;
  readonly footer: Locator;
  readonly video: Locator;
  readonly videoCaption: Locator;
  readonly transcript: Locator;
  readonly transcriptToggle: Locator;
  readonly videoUnavailable: Locator;
  readonly videoPoster: Locator;
  /** The hero panel: the sign-in or sign-up card. */
  readonly panel: Locator;
  readonly signInHeading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly keepSignedIn: Locator;
  readonly signInButton: Locator;
  readonly alert: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly resetPassword: Locator;
  readonly handOff: Locator;
  readonly joinHeading: Locator;
  readonly panelJoin: Locator;
  readonly panelSignIn: Locator;
  readonly name: Locator;
  readonly createAccount: Locator;
  readonly nameError: Locator;
  readonly checkInbox: Locator;
  readonly sendAgain: Locator;
  readonly signInWithGoogle: Locator;
  readonly signUpWithGoogle: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'Build with people who share your faith',
    });
    this.eyebrow = page.getByText('FaithTech Community', { exact: true });
    this.lead = page.getByText(/^Meet the builders, leads and volunteers in your city/);
    this.topBar = page.getByRole('banner');
    this.topBarJoin = this.topBar.getByRole('button', { name: 'Join now' });
    this.topBarSignIn = this.topBar.getByRole('button', { name: 'Sign in' });
    this.benefitsHeading = page.getByRole('heading', { level: 2, name: 'Why join' });
    this.benefits = page.getByRole('heading', { level: 3 });
    this.callToAction = page.getByRole('region', { name: 'Ready to build with us?' });
    this.callToActionJoin = this.callToAction.getByRole('button', { name: 'Join now' });
    this.footer = page.getByRole('contentinfo');
    this.video = page.locator('video');
    this.videoCaption = page.locator('figure figcaption');
    this.transcriptToggle = page.getByText('Read the transcript');
    this.transcript = page.locator('details').filter({ has: this.transcriptToggle });
    this.videoUnavailable = page.getByRole('status').filter({
      hasText: 'This video can’t play right now',
    });
    this.videoPoster = page.getByRole('img', { name: /FaithTech builders/ });
    this.panel = page.locator('ft-card').filter({ has: page.getByRole('heading', { level: 2 }) });
    this.signInHeading = page.getByRole('heading', { level: 2, name: 'Sign in' });
    this.email = this.panel.getByLabel('Email');
    this.password = this.panel.getByLabel('Password', { exact: true });
    this.keepSignedIn = this.panel.getByRole('switch', {
      name: 'Keep me signed in on this device',
    });
    this.signInButton = this.panel.getByRole('button', { name: /^(Sign in|Signing in…)$/ });
    this.alert = this.panel.locator('ft-alert [role=alert], ft-alert [role=status]');
    this.emailError = fieldError(page, 'Email');
    this.passwordError = fieldError(page, 'Password');
    this.resetPassword = this.panel.getByRole('link', { name: 'Reset password' });
    this.handOff = page.getByRole('heading', { level: 2, name: 'Signing you in…' });
    this.joinHeading = page.getByRole('heading', { level: 2, name: 'Join FaithTech' });
    this.panelJoin = this.panel.getByRole('button', { name: 'Join now' });
    this.panelSignIn = this.panel.getByRole('button', { name: 'Sign in', exact: true });
    this.name = this.panel.getByLabel('Full name');
    this.createAccount = this.panel.getByRole('button', {
      name: /Create account|Creating account/,
    });
    this.nameError = fieldError(page, 'Full name');
    this.checkInbox = page.getByRole('heading', { level: 2, name: 'Check your inbox' });
    this.sendAgain = this.panel.getByRole('link', { name: 'send it again' });
    this.signInWithGoogle = this.panel.getByRole('button', { name: 'Sign in with Google' });
    this.signUpWithGoogle = this.panel.getByRole('button', { name: 'Sign up with Google' });
  }

  /** Signs in from the hero panel and waits for the API's answer. */
  async signIn(
    email: string,
    password: string,
    options: { keepSignedIn?: boolean } = {},
  ): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    if (options.keepSignedIn) await this.keepSignedIn.check();
    const response = this.page.waitForResponse('**/api/account/sign-in');
    await this.signInButton.click();
    await response;
  }

  /** Fills in and submits the join form in the hero panel. */
  async join(name: string, email: string, password: string): Promise<void> {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.createAccount.click();
  }

  sentTo(email: string): Locator {
    return this.panel.getByText(`We sent a link to ${email}`);
  }

  /** Submits the sign-in form without filling anything in, so no request is made. */
  async submitEmptySignIn(): Promise<void> {
    await this.signInButton.click();
  }

  /** Starts the brochure as a visitor pressing its Play control would. */
  async playVideo(): Promise<void> {
    await this.video.evaluate((v: HTMLVideoElement) => v.play().catch(() => undefined));
  }

  /** What the visitor's browser knows about the brochure: playing state, captions and length. */
  videoState(): Promise<{
    paused: boolean;
    autoplay: boolean;
    muted: boolean;
    controls: boolean;
    poster: string;
    captions: { kind: string; language: string; mode: string }[];
  }> {
    return this.video.evaluate((v: HTMLVideoElement) => ({
      paused: v.paused,
      autoplay: v.autoplay,
      muted: v.muted,
      controls: v.controls,
      poster: v.poster,
      captions: [...v.textTracks].map((t) => ({
        kind: t.kind,
        language: t.language,
        mode: t.mode,
      })),
    }));
  }

  /** The brochure file's length in seconds, read from its metadata. */
  videoDuration(): Promise<number> {
    return this.video.evaluate(
      (v: HTMLVideoElement) =>
        new Promise<number>((resolve, reject) => {
          const probe = document.createElement('video');
          probe.preload = 'metadata';
          probe.onloadedmetadata = () => resolve(probe.duration);
          probe.onerror = () => reject(new Error('The brochure did not load.'));
          probe.src = v.currentSrc || v.src;
        }),
    );
  }

  /** Animations running on the page, which a reduced-motion visitor must not see. */
  runningAnimations(): Promise<number> {
    return this.page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    );
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`${MARKETING_URL}/${query}`);
  }
}
