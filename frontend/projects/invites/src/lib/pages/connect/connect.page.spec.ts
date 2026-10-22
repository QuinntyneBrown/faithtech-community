import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AUTH_SERVICE,
  CONNECT_SERVICE,
  ConnectLookupDto,
  ConnectOutcome,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { ConnectPage } from './connect.page';

const lead: ConnectLookupDto = {
  leadProfileId: 'p1',
  leadName: 'Grace Okonkwo',
  leadPhotoUrl: 'https://photos.example/grace.jpg',
  leadCity: 'Toronto',
  leadRole: 'City Lead',
};

async function setup(
  lookUp: () => Observable<ConnectLookupDto> = () => of(lead),
  signedIn: ConnectOutcome | null = null,
) {
  const connect = {
    lookUp: vi.fn(lookUp),
    signUp: vi.fn(() => of(undefined)),
    connect: vi.fn(() => of({ outcome: signedIn!, leadName: lead.leadName })),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CONNECT_SERVICE, useValue: connect },
      {
        provide: AUTH_SERVICE,
        useValue: {
          isAuthenticated: signal(signedIn !== null),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ConnectPage);
  fixture.componentRef.setInput('token', 'tok');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('button, a')).find(
      (b) => b.textContent?.trim() === name,
    );
  const type = (label: string, value: string) => {
    const field = Array.from(host.querySelectorAll('ft-form-field')).find(
      (f) => f.querySelector('label')?.textContent?.trim() === label,
    )!;
    const input = field.querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  return { fixture, host, connect, button, type, text, settle };
}

describe('ConnectPage', () => {
  it('shows who the visitor is connecting with and what connecting does', async () => {
    const { host, connect, text } = await setup();

    expect(connect.lookUp).toHaveBeenCalledWith('tok');
    expect(host.querySelector('h1')!.textContent).toContain('Connect with Grace');
    expect(text()).toContain('City Lead · Toronto');
    expect(text()).toContain('you’re added to Grace’s contacts');
    expect(text()).toContain('You won’t be given a role.');
    expect(host.querySelector('ft-link a, a[href*="sign-in"]')!.getAttribute('href')).toBe(
      '/sign-in?returnUrl=%2Fmeet%2Ftok',
    );
  });

  it('signs up through the link and asks the person to check their email', async () => {
    const { host, connect, button, type, settle } = await setup();
    type('Full name', ' Tomás Ortega ');
    type('Email', 'tomas@example.org');
    type('Password', 'a-long-enough-passphrase');

    button('Create account and connect')!.click();
    await settle();

    expect(connect.signUp).toHaveBeenCalledWith({
      token: 'tok',
      name: 'Tomás Ortega',
      email: 'tomas@example.org',
      password: 'a-long-enough-passphrase',
    });
    expect(host.querySelector('h1')!.textContent).toContain('Check your email');
    expect(host.textContent).toContain('tomas@example.org');
  });

  it('checks the fields with the L2-001 rules before sending', async () => {
    const { connect, button, type, text, settle } = await setup();
    type('Full name', 'Tomás');
    type('Email', 'tomas@example.org');
    type('Password', 'short');

    button('Create account and connect')!.click();
    await settle();

    expect(connect.signUp).not.toHaveBeenCalled();
    expect(text()).toContain('Fix 1 thing to create your account');
    expect(text()).toContain('Use at least 12 characters.');
  });

  it('shows the server’s field errors', async () => {
    const { connect, button, type, text, settle } = await setup();
    connect.signUp.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { Password: ['This password has appeared in a data breach.'] } },
          }),
      ),
    );
    type('Full name', 'Tomás');
    type('Email', 'tomas@example.org');
    type('Password', 'password1234567');

    button('Create account and connect')!.click();
    await settle();

    expect(text()).toContain('This password has appeared in a data breach.');
  });

  it('says an unknown or replaced code no longer works', async () => {
    const { host, button } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );

    expect(host.querySelector('h1')!.textContent).toContain('This code no longer works');
    expect(button('Create an account')!.getAttribute('href')).toBe('/sign-up');
  });

  it('offers Try again when the lookup cannot reach FaithTech', async () => {
    const { host, connect, button, settle } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    expect(host.querySelector('h1')!.textContent).toContain('We couldn’t load this page');
    connect.lookUp.mockReturnValue(of(lead));

    button('Try again')!.click();
    await settle();

    expect(host.querySelector('h1')!.textContent).toContain('Connect with Grace');
  });

  it.each<[ConnectOutcome, string, string]>([
    ['Connected', 'You’re connected', 'Connected with Grace Okonkwo'],
    ['Pending', 'Almost connected', 'Verify your email to finish'],
    ['OwnCode', 'Your QR code works', 'This is your own code'],
  ])('connects a signed-in member on arrival: %s', async (outcome, heading, alert) => {
    const { host, connect, text, settle } = await setup(() => of(lead), outcome);
    // The lookup and the connect answer one after the other.
    await settle();

    expect(connect.connect).toHaveBeenCalledWith('tok');
    expect(host.querySelector('h1')!.textContent).toContain(heading);
    expect(text()).toContain(alert);
    expect(host.querySelector('form')).toBeNull();
  });

  it('does not connect an anonymous visitor', async () => {
    const { connect } = await setup();
    expect(connect.connect).not.toHaveBeenCalled();
  });
});
