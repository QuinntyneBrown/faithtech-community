// Traces to: L2-045 AC6
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemePreference, ThemeService } from '@faithtech-community/components';

import { SettingsPage } from './settings.page';

function setup(initial: ThemePreference = 'system') {
  const preference = signal<ThemePreference>(initial);
  const theme = { preference, set: vi.fn((p: ThemePreference) => preference.set(p)) };
  TestBed.configureTestingModule({
    imports: [SettingsPage],
    providers: [{ provide: ThemeService, useValue: theme }],
  });
  const fixture = TestBed.createComponent(SettingsPage);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const radio = (label: string) =>
    [...host.querySelectorAll<HTMLLabelElement>('label')]
      .find((l) => l.textContent?.includes(label))
      ?.querySelector('input') as HTMLInputElement;
  return { fixture, host, theme, radio };
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
});
