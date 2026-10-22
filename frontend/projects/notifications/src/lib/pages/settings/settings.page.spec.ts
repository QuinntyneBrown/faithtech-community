// Traces to: L2-045 AC6, L2-030 AC2
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ANNOUNCEMENTS_SERVICE } from '@faithtech-community/api';
import { ThemePreference, ThemeService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { SettingsPage } from './settings.page';

function setup(
  initial: ThemePreference = 'system',
  options: { optedOut?: boolean; save?: () => Observable<void> } = {},
) {
  const preference = signal<ThemePreference>(initial);
  const theme = { preference, set: vi.fn((p: ThemePreference) => preference.set(p)) };
  const announcements = {
    getEmailOptOut: vi.fn(() => of(options.optedOut ?? false)),
    setEmailOptOut: vi.fn(options.save ?? (() => of(undefined))),
  };
  TestBed.configureTestingModule({
    imports: [SettingsPage],
    providers: [
      { provide: ThemeService, useValue: theme },
      { provide: ANNOUNCEMENTS_SERVICE, useValue: announcements },
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
  return { fixture, host, theme, radio, announcements, announcementsSwitch, settle };
}

describe('SettingsPage', () => {
  it('has the Settings heading and an Appearance card', () => {
    const { host } = setup();
    expect(host.querySelector('h1')?.textContent).toContain('Settings');
    const card = host.querySelector('[role="region"]');
    expect(card?.textContent).toContain('Appearance');
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
    expect(host.textContent).toContain('Saved');
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
});
