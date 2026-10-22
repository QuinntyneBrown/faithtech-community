// Traces to: L2-030 AC2, L2-052 AC4, L2-045 AC6
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ANNOUNCEMENTS_SERVICE } from '@faithtech-community/api';
import { ThemePreference, ThemeService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { SettingsPage } from './settings.page';

async function setup(
  read: () => Observable<boolean>,
  save: (optedOut: boolean) => Observable<void> = () => of(undefined),
  initialTheme: ThemePreference = 'system',
) {
  const service = { emailOptOut: vi.fn(read), setEmailOptOut: vi.fn(save) };
  const toasts = { show: vi.fn() };
  const preference = signal<ThemePreference>(initialTheme);
  const theme = { preference, set: vi.fn((p: ThemePreference) => preference.set(p)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: ANNOUNCEMENTS_SERVICE, useValue: service },
      { provide: ToastService, useValue: toasts },
      { provide: ThemeService, useValue: theme },
    ],
  });
  const fixture = TestBed.createComponent(SettingsPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const toggle = () => host.querySelector<HTMLInputElement>('input[role="switch"]')!;
  const flip = async () => {
    toggle().click();
    await settle();
  };
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const radio = (label: string) =>
    [...host.querySelectorAll<HTMLLabelElement>('label')]
      .find((l) => l.textContent?.includes(label))
      ?.querySelector('input') as HTMLInputElement;
  return { host, service, toasts, theme, settle, toggle, flip, button, radio };
}

describe('SettingsPage', () => {
  it('has an Appearance card with Light, Dark and Match my device, the current one checked', async () => {
    const { host, radio } = await setup(() => of(false), undefined, 'dark');

    const cards = [...host.querySelectorAll('[role="region"]')].map((c) => c.textContent ?? '');
    expect(cards.some((text) => text.includes('Appearance'))).toBe(true);
    expect(radio('Light').checked).toBe(false);
    expect(radio('Dark').checked).toBe(true);
    expect(radio('Match my device').checked).toBe(false);
  });

  it('applies a theme at once through the theme service', async () => {
    const { radio, settle, theme } = await setup(() => of(false));

    radio('Dark').click();
    await settle();

    expect(theme.set).toHaveBeenCalledWith('dark');
  });

  it('keeps Appearance usable while the email settings fail to load', async () => {
    const { host, radio } = await setup(() => throwError(() => new Error('offline')));

    expect(host.textContent).toContain('We couldn’t load your settings');
    expect(radio('Light')).toBeTruthy();
  });

  it('shows announcement emails on for a member who has not opted out', async () => {
    const { host, toggle } = await setup(() => of(false));

    expect(host.querySelector('h1')!.textContent).toContain('Settings');
    expect(host.textContent).toContain('Email me when');
    expect(toggle().closest('label')!.textContent).toContain('Email me announcements');
    expect(toggle().checked).toBe(true);
    expect(host.textContent).toContain('You’ll always get account emails like password resets.');
  });

  it('saves turning announcement emails off at once and says so', async () => {
    const { flip, service, toasts, toggle } = await setup(() => of(false));

    await flip();

    expect(service.setEmailOptOut).toHaveBeenCalledWith(true);
    expect(toggle().checked).toBe(false);
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', heading: 'Settings saved' }),
    );
  });

  it('turns them back on for a member who opted out', async () => {
    const { flip, service, toggle } = await setup(() => of(true));
    expect(toggle().checked).toBe(false);

    await flip();

    expect(service.setEmailOptOut).toHaveBeenCalledWith(false);
  });

  it('puts the switch back and warns when saving fails', async () => {
    const { flip, toasts, toggle } = await setup(
      () => of(false),
      () => throwError(() => new Error('offline')),
    );

    await flip();

    expect(toggle().checked).toBe(true);
    expect(toasts.show).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' }));
  });

  it('offers Try again when settings cannot load', async () => {
    let fail = true;
    const { host, button, settle, toggle } = await setup(() =>
      fail ? throwError(() => new Error('offline')) : of(false),
    );
    expect(host.textContent).toContain('We couldn’t load your settings');

    fail = false;
    button('Try again')!.click();
    await settle();

    expect(toggle().checked).toBe(true);
  });
});
