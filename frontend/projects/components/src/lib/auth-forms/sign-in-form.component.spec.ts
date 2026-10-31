// Traces to: L2-003, L2-076
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ORGANISATION_NAMES } from '../organisation-names/organisation-names';

import {
  SignInCredentials,
  SignInFormComponent,
  SignInFormFailure,
} from './sign-in-form.component';

@Component({
  imports: [SignInFormComponent],
  template: `<ft-sign-in-form
    [busy]="busy()"
    [failure]="failure()"
    divider="or"
    (submitted)="sent.push($event)"
    ><button ftAuthAlternatives type="button">Sign in with Google</button></ft-sign-in-form
  >`,
})
class HostComponent {
  busy = signal(false);
  failure = signal<SignInFormFailure | null>(null);
  sent: SignInCredentials[] = [];
}

describe('SignInFormComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ORGANISATION_NAMES,
          useValue: { name: signal('Northside Makers'), shortName: signal('Northside') },
        },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = (label: string) =>
      [...el.querySelectorAll('ft-form-field')]
        .find((f) => f.querySelector('label')?.textContent?.includes(label))!
        .querySelector('input')!;
    return { fixture, el, host: fixture.componentInstance, input };
  }

  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('sends the credentials and the keep-me-signed-in choice', () => {
    const { el, host, input } = setup();
    type(input('Email'), 'grace@example.org');
    type(input('Password'), 'a-long-enough-passphrase');

    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(host.sent).toEqual([
      { email: 'grace@example.org', password: 'a-long-enough-passphrase', keepSignedIn: false },
    ]);
  });

  it('asks for empty fields instead of sending', () => {
    const { fixture, el, host } = setup();

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(host.sent).toEqual([]);
    expect(el.textContent).toContain('Enter your email address.');
    expect(el.textContent).toContain('Enter your password.');
  });

  it.each<[SignInFormFailure, string]>([
    ['invalid_credentials', 'We couldn’t sign you in'],
    ['locked_out', 'Too many attempts'],
    ['suspended', 'This account is suspended'],
    ['unreachable', 'We couldn’t reach Northside'],
    ['google_failed', 'Google sign-in didn’t finish'],
  ])('shows the %s failure', (failure, heading) => {
    const { fixture, el, host } = setup();

    host.failure.set(failure);
    fixture.detectChanges();

    expect(el.querySelector('ft-alert')?.textContent).toContain(heading);
  });

  it('puts the other ways in above the fields with an "or" divider', () => {
    const { el } = setup();
    const form = el.querySelector('form')!;

    const google = form.querySelector('button[type=button]')!;
    expect(google.textContent).toBe('Sign in with Google');
    expect(form.querySelector('.auth-form__divider')?.textContent?.trim()).toBe('or');
    expect(
      google.compareDocumentPosition(form.querySelector('ft-form-field')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('is busy while signing in', () => {
    const { fixture, el, host } = setup();

    host.busy.set(true);
    fixture.detectChanges();

    const submit = el.querySelector('button[type=submit]')!;
    expect(submit.getAttribute('aria-busy')).toBe('true');
    expect(submit.textContent).toContain('Signing in…');
  });
});
