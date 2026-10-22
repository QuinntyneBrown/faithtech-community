// Traces to: L2-067, L2-069
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AUTH_SERVICE, BROWSER_REDIRECT, SignInOutcome } from '@faithtech-community/api';
import { Observable, of } from 'rxjs';

import { COMMUNITY_ORIGIN } from '../community-origin';
import { LandingPage } from './landing.page';

describe('LandingPage', () => {
  let redirects: string[];
  let outcome: Observable<SignInOutcome>;
  let google: [string | undefined, boolean | undefined][];
  let kept: boolean;

  beforeEach(() => {
    redirects = [];
    google = [];
    kept = false;
    outcome = of({ succeeded: true, emailVerified: true });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: COMMUNITY_ORIGIN, useValue: 'https://app.faithtech.test' },
        { provide: BROWSER_REDIRECT, useValue: (url: string) => redirects.push(url) },
        {
          provide: AUTH_SERVICE,
          useValue: {
            signInWithPassword: () => outcome,
            signInWithGoogle: (url?: string, keep?: boolean) => google.push([url, keep]),
            hasKeptSession: () => kept,
          },
        },
      ],
    });
  });

  async function signInWith(returnUrl: string | undefined) {
    const fixture = TestBed.createComponent(LandingPage);
    if (returnUrl !== undefined) fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const field = (label: string) =>
      [...el.querySelectorAll('ft-form-field')]
        .find((f) => f.querySelector('label')?.textContent?.includes(label))!
        .querySelector('input')!;
    for (const [label, value] of [
      ['Email', 'grace@example.org'],
      ['Password', 'a-long-enough-passphrase'],
    ]) {
      field(label).value = value;
      field(label).dispatchEvent(new Event('input'));
    }
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    return el;
  }

  it('names the community in the page heading', async () => {
    const fixture = TestBed.createComponent(LandingPage);
    await fixture.whenStable();

    const heading = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('Build with people who share your faith');
  });

  it('hands a signed-in visitor to the community app with the page they asked for', async () => {
    await signInWith('/events');

    expect(redirects).toEqual([
      'https://app.faithtech.test/auth/continue?returnUrl=%2Fevents&keepSignedIn=0',
    ]);
  });

  it('never carries a return url that leaves the community app', async () => {
    await signInWith('//evil.example/steal');

    expect(redirects).toEqual([
      'https://app.faithtech.test/auth/continue?returnUrl=%2F&keepSignedIn=0',
    ]);
  });

  it('tells an unverified member they will be asked to verify in the app', async () => {
    outcome = of({ succeeded: true, emailVerified: false });

    const el = await signInWith(undefined);

    expect(el.textContent).toContain('Your email isn’t verified yet');
  });

  // Traces to: L2-071
  it('starts Google sign-in with the page asked for and shows the button busy', async () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.componentRef.setInput('returnUrl', '/events');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = () =>
      [...el.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Sign in with Google'),
      )!;

    button().click();
    await fixture.whenStable();

    expect(google).toEqual([['/events', false]]);
    expect(button().getAttribute('aria-busy')).toBe('true');
  });

  it('shows how Google sign-in ended when the visitor comes back', async () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.componentRef.setInput('google', 'suspended');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'This account is suspended',
    );
  });

  // Traces to: L2-067 AC6
  it('sends a member with a kept session straight to the community app', async () => {
    kept = true;
    const fixture = TestBed.createComponent(LandingPage);
    fixture.componentRef.setInput('returnUrl', '/events');
    await fixture.whenStable();

    expect(redirects).toEqual(['https://app.faithtech.test/events']);
  });
});
