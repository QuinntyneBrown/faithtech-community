import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LogoMarkComponent } from './logo-mark.component';

@Component({
  imports: [LogoMarkComponent],
  template: `<ft-logo-mark [label]="label()" />`,
})
class HostComponent {
  label = signal('FaithTech');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const svg = () => fixture.nativeElement.querySelector('svg') as SVGElement;
  return { fixture, cmp: fixture.componentInstance, svg };
}

describe('LogoMarkComponent', () => {
  it('is an image named FaithTech by default', () => {
    const { svg } = setup();
    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('FaithTech');
  });

  it('uses the 64 unit artwork', () => {
    const { svg } = setup();
    expect(svg().getAttribute('viewBox')).toBe('0 0 64 64');
  });

  it('becomes decorative when the label is empty', () => {
    const { fixture, cmp, svg } = setup();
    cmp.label.set('');
    fixture.detectChanges();
    expect(svg().getAttribute('aria-hidden')).toBe('true');
    expect(svg().getAttribute('role')).toBeNull();
  });

  it('is never focusable', () => {
    const { svg } = setup();
    expect(svg().getAttribute('focusable')).toBe('false');
  });
});
