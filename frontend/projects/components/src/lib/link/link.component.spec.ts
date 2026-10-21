import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LinkComponent } from './link.component';

@Component({
  imports: [LinkComponent],
  template: `<ft-link [href]="href()" [external]="external()">Forgot your password?</ft-link>`,
})
class HostComponent {
  href = signal('/forgot-password');
  external = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const a = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
  return { fixture, cmp: fixture.componentInstance, a };
}

describe('LinkComponent', () => {
  it('renders a native anchor with the projected text and href', () => {
    const { a } = setup();
    expect(a.getAttribute('href')).toBe('/forgot-password');
    expect(a.textContent).toContain('Forgot your password?');
  });

  it('updates the destination', () => {
    const { fixture, cmp, a } = setup();
    cmp.href.set('/sign-in');
    fixture.detectChanges();
    expect(a.getAttribute('href')).toBe('/sign-in');
  });

  it('opens external links safely in a new tab', () => {
    const { fixture, cmp, a } = setup();
    cmp.external.set(true);
    fixture.detectChanges();
    expect(a.target).toBe('_blank');
    expect(a.rel).toContain('noopener');
  });

  it('keeps same-tab behaviour for internal links', () => {
    const { a } = setup();
    expect(a.getAttribute('target')).toBeNull();
  });
});
