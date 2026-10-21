import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChipComponent } from './chip.component';

@Component({
  imports: [ChipComponent],
  template: `<ft-chip
    [(pressed)]="pressed"
    [disabled]="disabled()"
    [href]="href()"
    [current]="current()"
    >Upcoming</ft-chip
  >`,
})
class HostComponent {
  pressed = signal(false);
  disabled = signal(false);
  href = signal<string | null>(null);
  current = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const q = <T extends Element>(s: string) => fixture.nativeElement.querySelector(s) as T;
  return { fixture, cmp: fixture.componentInstance, q };
}

describe('ChipComponent', () => {
  it('renders a toggle button with aria-pressed', () => {
    const { q } = setup();
    const btn = q<HTMLButtonElement>('button');
    expect(btn.type).toBe('button');
    expect(btn.textContent).toContain('Upcoming');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles pressed on click and reports it', () => {
    const { fixture, cmp, q } = setup();
    q<HTMLButtonElement>('button').click();
    fixture.detectChanges();
    expect(cmp.pressed()).toBe(true);
    expect(q('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('reflects an externally pressed state', () => {
    const { fixture, cmp, q } = setup();
    cmp.pressed.set(true);
    fixture.detectChanges();
    expect(q('button').classList.contains('ft-chip--pressed')).toBe(true);
  });

  it('does not toggle when disabled', () => {
    const { fixture, cmp, q } = setup();
    cmp.disabled.set(true);
    fixture.detectChanges();
    q<HTMLButtonElement>('button').click();
    expect(cmp.pressed()).toBe(false);
    expect(q<HTMLButtonElement>('button').disabled).toBe(true);
  });

  it('renders a view chip as a link with aria-current for the current view', () => {
    const { fixture, cmp, q } = setup();
    cmp.href.set('/backlog');
    cmp.current.set(true);
    fixture.detectChanges();
    expect(q('button')).toBeNull();
    const a = q<HTMLAnchorElement>('a');
    expect(a.getAttribute('href')).toBe('/backlog');
    expect(a.getAttribute('aria-current')).toBe('page');
    expect(a.classList.contains('ft-chip--pressed')).toBe(true);
    expect(a.textContent).toContain('Upcoming');
  });

  it('does not mark a non-current view chip', () => {
    const { fixture, cmp, q } = setup();
    cmp.href.set('/backlog');
    fixture.detectChanges();
    expect(q('a').getAttribute('aria-current')).toBeNull();
  });
});
