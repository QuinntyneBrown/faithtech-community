import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BadgeComponent, BadgeVariant } from './badge.component';

@Component({
  imports: [BadgeComponent],
  template: `<ft-badge [variant]="variant()">Public</ft-badge>`,
})
class HostComponent {
  variant = signal<BadgeVariant>('neutral');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const span = () => fixture.nativeElement.querySelector('span') as HTMLElement;
  return { fixture, cmp: fixture.componentInstance, span };
}

describe('BadgeComponent', () => {
  it('renders the projected label in a non-interactive span', () => {
    const { span } = setup();
    expect(span().textContent).toContain('Public');
    expect(span().tabIndex).toBe(-1);
    expect(span().getAttribute('role')).toBeNull();
  });

  it.each(['neutral', 'info', 'success', 'warning', 'danger', 'role', 'count'] as const)(
    'applies the %s variant',
    (v) => {
      const { fixture, cmp, span } = setup();
      cmp.variant.set(v);
      fixture.detectChanges();
      expect(span().classList.contains(`ft-badge--${v}`)).toBe(true);
    },
  );

  it('defaults to neutral', () => {
    const { span } = setup();
    expect(span().classList.contains('ft-badge--neutral')).toBe(true);
  });
});
