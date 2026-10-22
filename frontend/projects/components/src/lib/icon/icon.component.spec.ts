import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';
import { ICON_NAMES } from './icons';

interface Inputs {
  name: string;
  size: 'sm' | 'md' | 'lg';
  label: string | null;
}

function setup(patch: Partial<Inputs> = {}) {
  const fixture = TestBed.createComponent(IconComponent);
  const inputs: Inputs = { name: 'add', size: 'md', label: null, ...patch };
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, svg: host.querySelector('svg') as SVGElement };
}

describe('IconComponent', () => {
  it('renders an inline 24 unit svg for the named icon', () => {
    const { svg } = setup({ name: 'add' });
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe('M12 5v14M5 12h14');
  });

  it('is decorative (aria-hidden) by default', () => {
    const { svg } = setup();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
  });

  it('exposes an accessible name when labelled', () => {
    const { svg } = setup({ label: 'Add contact' });
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Add contact');
  });

  it.each(['sm', 'md', 'lg'] as const)('maps size %s to a size class', (size) => {
    const { host } = setup({ size });
    expect(host.classList.contains(`ft-icon--${size}`)).toBe(true);
  });

  it('renders nothing for an unknown name', () => {
    const { svg } = setup({ name: 'nope' });
    expect(svg.querySelector('path, circle, rect')).toBeNull();
  });

  // Traces to: Dynamics adoptions (docs/screen-composition.md, foundations/iconography.html).
  // Given the iconography sheet's Call, Merge, Reports and Add walk-in glyphs,
  // When each is rendered by name, Then its sheet path is drawn.
  it.each([
    [
      'call',
      'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    ],
    ['merge', 'M7 3v6a5 5 0 0 0 5 5 5 5 0 0 1 5 5v2M7 21v-6M17 3v3'],
    ['reports', 'M4 20V10M10 20V4M16 20v-7M22 20H2'],
    ['walk-in', 'M3 21a7 7 0 0 1 14 0M19 8v6M16 11h6'],
  ])('draws the %s icon from the sheet', (name, d) => {
    const { svg } = setup({ name });
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(d);
  });

  it('ships the full 63 icon set', () => {
    expect(ICON_NAMES.length).toBe(63);
    for (const name of ICON_NAMES) {
      expect(setup({ name }).svg.innerHTML.length).toBeGreaterThan(0);
    }
  });
});
