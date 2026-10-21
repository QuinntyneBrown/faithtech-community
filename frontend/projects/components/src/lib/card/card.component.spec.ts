import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardComponent, CardVariant } from './card.component';

@Component({
  imports: [CardComponent],
  template: `<ft-card
    [variant]="variant()"
    [heading]="heading()"
    [headingLevel]="level()"
    [busy]="busy()"
    ><p class="inner">Body</p></ft-card
  >`,
})
class HostComponent {
  variant = signal<CardVariant>('plain');
  heading = signal<string | null>('Recent activity');
  level = signal<2 | 3 | 4>(2);
  busy = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const card = () => fixture.nativeElement.querySelector('ft-card') as HTMLElement;
  return { fixture, cmp: fixture.componentInstance, card };
}

describe('CardComponent', () => {
  it('projects its content', () => {
    const { card } = setup();
    expect(card().querySelector('.inner')?.textContent).toBe('Body');
  });

  it('renders the heading as a real heading that names the region', () => {
    const { card } = setup();
    const h = card().querySelector('h2') as HTMLElement;
    expect(h.textContent).toContain('Recent activity');
    expect(card().getAttribute('role')).toBe('region');
    expect(card().getAttribute('aria-labelledby')).toBe(h.id);
  });

  it('honours the heading level', () => {
    const { fixture, cmp, card } = setup();
    cmp.level.set(3);
    fixture.detectChanges();
    expect(card().querySelector('h3')).not.toBeNull();
    expect(card().querySelector('h2')).toBeNull();
  });

  it('has no landmark role without a heading', () => {
    const { fixture, cmp, card } = setup();
    cmp.heading.set(null);
    fixture.detectChanges();
    expect(card().getAttribute('role')).toBeNull();
    expect(card().querySelector('h2')).toBeNull();
  });

  it.each(['plain', 'flush', 'strip', 'success'] as const)('applies the %s variant', (v) => {
    const { fixture, cmp, card } = setup();
    cmp.variant.set(v);
    fixture.detectChanges();
    expect(card().classList.contains(`ft-card--${v}`)).toBe(true);
  });

  it('announces a success card as status', () => {
    const { fixture, cmp, card } = setup();
    cmp.variant.set('success');
    fixture.detectChanges();
    expect(card().getAttribute('role')).toBe('status');
  });

  it('marks itself busy while loading', () => {
    const { fixture, cmp, card } = setup();
    expect(card().getAttribute('aria-busy')).toBeNull();
    cmp.busy.set(true);
    fixture.detectChanges();
    expect(card().getAttribute('aria-busy')).toBe('true');
  });
});
