// Traces to: L2-001, L2-077
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SignUpDetails, SignUpFormComponent, SignUpFormErrors } from './sign-up-form.component';

@Component({
  imports: [SignUpFormComponent],
  template: `<ft-sign-up-form
    [busy]="busy()"
    [unreachable]="unreachable()"
    [serverErrors]="serverErrors()"
    (submitted)="sent.push($event)"
  />`,
})
class HostComponent {
  busy = signal(false);
  unreachable = signal(false);
  serverErrors = signal<SignUpFormErrors>({});
  sent: SignUpDetails[] = [];
}

describe('SignUpFormComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = (label: string) =>
      [...el.querySelectorAll('ft-form-field')]
        .find((f) => f.querySelector('label')?.textContent?.includes(label))!
        .querySelector('input')!;
    const type = (label: string, value: string) => {
      input(label).value = value;
      input(label).dispatchEvent(new Event('input'));
    };
    const submit = () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, el, host: fixture.componentInstance, type, submit };
  }

  it('sends a valid form', () => {
    const { host, type, submit } = setup();
    type('Full name', 'Leah Thompson');
    type('Email', 'leah@example.org');
    type('Password', 'a-long-enough-passphrase');

    submit();

    expect(host.sent).toEqual([
      { name: 'Leah Thompson', email: 'leah@example.org', password: 'a-long-enough-passphrase' },
    ]);
  });

  it('catches a short password, a bad email and a long name before sending', () => {
    const { el, host, type, submit } = setup();
    type('Full name', 'x'.repeat(101));
    type('Email', 'leah');
    type('Password', 'maple7');

    submit();

    expect(host.sent).toEqual([]);
    expect(el.textContent).toContain('Fix 3 things to create your account');
    expect(el.textContent).toContain('Use 100 characters or fewer for your name.');
    expect(el.textContent).toContain('Enter an email address like name@example.com.');
    expect(el.textContent).toContain('Use at least 12 characters.');
  });

  it('shows the server’s field errors and the unreachable message', () => {
    const { fixture, el, host } = setup();

    host.serverErrors.set({ password: 'This password has appeared in a data breach.' });
    fixture.detectChanges();
    expect(el.textContent).toContain('This password has appeared in a data breach.');

    host.serverErrors.set({});
    host.unreachable.set(true);
    fixture.detectChanges();
    expect(el.textContent).toContain('We couldn’t create your account');
  });
});
