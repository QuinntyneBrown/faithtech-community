// Traces to: L2-055, L2-057
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AUTH_SERVICE, BROWSER_REDIRECT, SignInOutcome } from '@faithtech-community/api';
import { Observable, of } from 'rxjs';

import { COMMUNITY_ORIGIN } from '../community-origin';
import { LandingPage } from './landing.page';

describe('LandingPage', () => {
  let redirects: string[];
  let outcome: Observable<SignInOutcome>;

  beforeEach(() => {
    redirects = [];
    outcome = of({ succeeded: true, emailVerified: true });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: COMMUNITY_ORIGIN, useValue: 'https://app.faithtech.test' },
        { provide: BROWSER_REDIRECT, useValue: (url: string) => redirects.push(url) },
        { provide: AUTH_SERVICE, useValue: { signInWithPassword: () => outcome } },
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
});
