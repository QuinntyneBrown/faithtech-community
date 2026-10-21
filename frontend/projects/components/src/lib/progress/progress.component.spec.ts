import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProgressComponent } from './progress.component';

@Component({
  imports: [ProgressComponent],
  template: `<ft-progress
    [value]="value()"
    [max]="max()"
    [label]="label()"
    [size]="size()"
    [caption]="caption()"
  />`,
})
class HostComponent {
  value = signal(6);
  max = signal(24);
  label = signal('Sprint 7: 6 of 24 points done');
  size = signal<'md' | 'lg'>('md');
  caption = signal<string | null>('6 of 24 points');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const q = <T extends Element>(s: string) => fixture.nativeElement.querySelector(s) as T;
  const fill = () => q<HTMLElement>('.ft-progress__bar').style.getPropertyValue('--value');
  return { fixture, cmp: fixture.componentInstance, q, fill };
}

describe('ProgressComponent', () => {
  it('exposes a read-only progressbar with value, range and name', () => {
    const { q } = setup();
    const bar = q('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe('6');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('24');
    expect(bar.getAttribute('aria-label')).toBe('Sprint 7: 6 of 24 points done');
    expect(bar.hasAttribute('tabindex')).toBe(false);
  });

  it('sizes the fill as a percentage of max', () => {
    const { fill } = setup();
    expect(fill()).toBe('25%');
  });

  it('clamps the fill between 0 and 100 percent', () => {
    const { fixture, cmp, fill } = setup();
    cmp.value.set(99);
    fixture.detectChanges();
    expect(fill()).toBe('100%');
    cmp.value.set(-3);
    fixture.detectChanges();
    expect(fill()).toBe('0%');
  });

  it('shows the empty track at zero', () => {
    const { fixture, cmp, fill } = setup();
    cmp.value.set(0);
    fixture.detectChanges();
    expect(fill()).toBe('0%');
  });

  it('is not complete while in progress', () => {
    const { q } = setup();
    expect(q('.ft-progress').classList.contains('ft-progress--complete')).toBe(false);
  });

  it('uses the complete variant when the whole amount is done', () => {
    const { fixture, cmp, q } = setup();
    cmp.value.set(24);
    fixture.detectChanges();
    expect(q('.ft-progress').classList.contains('ft-progress--complete')).toBe(true);
  });

  it('supports the large size', () => {
    const { fixture, cmp, q } = setup();
    cmp.size.set('lg');
    fixture.detectChanges();
    expect(q('.ft-progress').classList.contains('ft-progress--lg')).toBe(true);
  });

  it('shows the visible caption beside the bar', () => {
    const { q } = setup();
    expect(q('.ft-progress-label').textContent?.trim()).toBe('6 of 24 points');
  });

  it('omits the caption when none is given', () => {
    const { fixture, cmp, q } = setup();
    cmp.caption.set(null);
    fixture.detectChanges();
    expect(q('.ft-progress-label')).toBeNull();
  });
});
