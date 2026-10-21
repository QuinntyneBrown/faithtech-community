import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SkeletonComponent, SkeletonShape } from './skeleton.component';

@Component({
  imports: [SkeletonComponent],
  template: `<ft-skeleton
    [shape]="shape()"
    [size]="size()"
    [width]="width()"
    [height]="height()"
  />`,
})
class HostComponent {
  shape = signal<SkeletonShape>('text');
  size = signal<'sm' | 'md' | 'lg' | 'xl'>('sm');
  width = signal<string | null>(null);
  height = signal<string | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = () => fixture.nativeElement.querySelector('ft-skeleton') as HTMLElement;
  return { fixture, cmp: fixture.componentInstance, el };
}

describe('SkeletonComponent', () => {
  it('is hidden from assistive technology', () => {
    const { el } = setup();
    expect(el().getAttribute('aria-hidden')).toBe('true');
  });

  it.each(['text', 'title', 'rect', 'avatar', 'date-badge'] as const)(
    'renders the %s shape',
    (s) => {
      const { fixture, cmp, el } = setup();
      cmp.shape.set(s);
      fixture.detectChanges();
      expect(el().classList.contains(`ft-skeleton--${s}`)).toBe(true);
    },
  );

  it.each(['sm', 'md', 'lg', 'xl'] as const)('sizes the avatar shape as %s', (s) => {
    const { fixture, cmp, el } = setup();
    cmp.shape.set('avatar');
    cmp.size.set(s);
    fixture.detectChanges();
    expect(el().classList.contains(`ft-skeleton--avatar-${s}`)).toBe(true);
  });

  it('accepts an explicit width and height', () => {
    const { fixture, cmp, el } = setup();
    cmp.shape.set('rect');
    cmp.width.set('12rem');
    cmp.height.set('4rem');
    fixture.detectChanges();
    expect(el().style.width).toBe('12rem');
    expect(el().style.height).toBe('4rem');
  });
});
