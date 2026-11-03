// Traces to: L2-045 AC6, L2-030 AC2, L2-052
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ACCOUNT_SERVICE, ANNOUNCEMENTS_SERVICE, AUTH_SERVICE } from '@faithtech-community/api';
import { ThemePreference, ThemeService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { SettingsPage } from './settings.page';

function setup(
  initial: ThemePreference = 'system',
  options: {
    optedOut?: boolean;
    save?: () => Observable<void>;
    update?: () => Observable<unknown>;
  } = {},
) {
  const preference = signal<ThemePreference>(initial);
  const theme = { preference, set: vi.fn((p: ThemePreference) => preference.set(p)) };
  const announcements = {
    getEmailOptOut: vi.fn(() => of(options.optedOut ?? false)),
    setEmailOptOut: vi.fn(options.save ?? (() => of(undefined))),
  };
  const account = {
    get: vi.fn(() => of({ email: 'grace@example.org', hasPassword: true })),
    update: vi.fn(
      options.update ?? (() => of({ pendingEmail: 'grace.o@example.org', passwordChanged: false })),
    ),
  };
  const auth = { currentUser: () => null, signOut: vi.fn(() => of(undefined)) };
  TestBed.configureTestingModule({
    imports: [SettingsPage],
    providers: [
      { provide: ThemeService, useValue: theme },
      { provide: ANNOUNCEMENTS_SERVICE, useValue: announcements },
      { provide: ACCOUNT_SERVICE, useValue: account },
      { provide: AUTH_SERVICE, useValue: auth },
    ],
  });
  const fixture = TestBed.createComponent(SettingsPage);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const radio = (label: string) =>
    [...host.querySelectorAll<HTMLLabelElement>('label')]
      .find((l) => l.textContent?.includes(label))
      ?.querySelector('input') as HTMLInputElement;
  const announcementsSwitch = () =>
    host.querySelector<HTMLInputElement>('input[role="switch"]') as HTMLInputElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const input = (label: string) =>
    host.querySelector<HTMLInputElement>(
      `#${[...host.querySelectorAll('label')].find((l) => l.textContent?.includes(label))!.htmlFor}`,
    )!;
  const type = (label: string, value: string) => {
    input(label).value = value;
    input(label).dispatchEvent(new Event('input'));
  };
  const submit = () => host.querySelector('form')!.dispatchEvent(new Event('submit'));
  return {
    fixture,
    host,
    theme,
    radio,
    announcements,
    announcementsSwitch,
    settle,
    account,
    input,
    type,
    submit,
  };
}

describe('SettingsPage', () => {
  it('has the Settings heading and an Appearance card', () => {
    const { host } = setup();
    expect(host.querySelector('h1')?.textContent).toContain('Settings');
    const cards = [...host.querySelectorAll('[role="region"]')].map((c) => c.textContent);
    expect(cards.some((c) => c?.includes('Appearance'))).toBe(true);
  });

  it('offers Light, Dark and Match my device, with the current preference checked', async () => {
    const { fixture, radio } = setup('dark');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(radio('Light').checked).toBe(false);
    expect(radio('Dark').checked).toBe(true);
    expect(radio('Match my device').checked).toBe(false);
  });

  it('applies a choice at once through the theme service', () => {
    const { fixture, radio, theme } = setup();
    radio('Dark').click();
    fixture.detectChanges();
    expect(theme.set).toHaveBeenCalledWith('dark');
    radio('Match my device').click();
    expect(theme.set).toHaveBeenLastCalledWith('system');
  });

  it('shows Email me announcements on for a member who has not opted out', async () => {
    const { host, announcementsSwitch, settle } = setup();
    await settle();

    expect(host.textContent).toContain('Email me when');
    expect(announcementsSwitch().checked).toBe(true);
    expect(host.textContent).toContain('You’ll always get account emails like password resets.');
  });

  it('shows the switch off for a member who opted out', async () => {
    const { announcementsSwitch, settle } = setup('system', { optedOut: true });
    await settle();

    expect(announcementsSwitch().checked).toBe(false);
  });

  it('saves the opt-out when announcement emails are turned off', async () => {
    const { host, announcements, announcementsSwitch, settle } = setup();
    await settle();

    announcementsSwitch().click();
    await settle();

    expect(announcements.setEmailOptOut).toHaveBeenCalledWith(true);
    expect(host.textContent).toContain('Settings saved');
  });

  it('puts the switch back and says so when saving fails', async () => {
    const { host, announcementsSwitch, settle } = setup('system', {
      save: () => throwError(() => new Error('offline')),
    });
    await settle();

    announcementsSwitch().click();
    await settle();

    expect(announcementsSwitch().checked).toBe(true);
    expect(host.textContent).toContain('We couldn’t save that. Try again.');
  });

  it('shows the sign-in email in the Account card', async () => {
    const { input, settle } = setup();
    await settle();
    expect(input('Email').value).toBe('grace@example.org');
  });

  it('saves a new email and says where the link went, keeping the current one', async () => {
    const { account, host, input, type, submit, settle } = setup();
    await settle();
    type('Email', 'grace.o@example.org');
    submit();
    await settle();
    expect(account.update).toHaveBeenCalledWith({ email: 'grace.o@example.org' });
    expect(host.textContent).toContain('We sent a link to grace.o@example.org.');
    expect(input('Email').value).toBe('grace@example.org');
  });

  it('asks for the current password before sending a new one', async () => {
    const { account, host, type, submit, settle } = setup();
    await settle();
    type('New password', 'kestrel-labs-2026');
    submit();
    await settle();
    expect(account.update).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Enter your current password to change it.');
    expect(host.textContent).toContain('Fix 1 thing to save');
  });

  it('shows the API’s field error under its field', async () => {
    const refused = new HttpErrorResponse({
      status: 400,
      error: { errors: { CurrentPassword: ['Your current password is incorrect.'] } },
    });
    const { host, type, submit, settle } = setup('system', {
      update: () => throwError(() => refused),
    });
    await settle();
    type('Current password', 'not-it');
    type('New password', 'kestrel-labs-2026');
    submit();
    await settle();
    expect(host.textContent).toContain('Your current password is incorrect.');
  });
});
