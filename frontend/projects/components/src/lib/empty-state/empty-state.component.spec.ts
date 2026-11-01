import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmptyStateComponent, EmptyStateVariant } from './empty-state.component';

@Component({
  imports: [EmptyStateComponent],
  template: `<ft-empty-state
    [variant]="variant()"
    heading="No contacts yet"
    text="Keep track of people you meet."
    [headingLevel]="level()"
    ><button actions type="button">Add your first contact</button></ft-empty-state
  >`,
})
class HostComponent {
  variant = signal<EmptyStateVariant>('empty');
  level = signal<1 | 2 | 3>(2);
}

@Component({
  imports: [EmptyStateComponent],
  template: `<ft-empty-state
    size="sm"
    icon="search"
    [headingLevel]="3"
    heading="No hubs match “Builders”."
  />`,
})
class SmallHostComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('EmptyStateComponent', () => {
  it('shows a heading, text and the projected action', () => {
    const { el } = setup();
    expect(el.querySelector('h2')?.textContent).toBe('No contacts yet');
    expect(el.querySelector('.ft-empty__text')?.textContent).toBe('Keep track of people you meet.');
    expect(el.querySelector('.ft-empty__actions button')?.textContent).toContain('Add your first');
  });

  it('hides the decorative icon from assistive tech', () => {
    const { el } = setup();
    const icon = el.querySelector('.ft-empty__icon') as HTMLElement;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.querySelector('ft-icon')).not.toBeNull();
  });

  it('is not an alert in the plain empty variant', () => {
    const { el } = setup();
    expect(el.querySelector('ft-empty-state')?.getAttribute('role')).toBeNull();
  });

  it('is an alert in the error variant', () => {
    const { fixture, cmp, el } = setup();
    cmp.variant.set('error');
    fixture.detectChanges();
    const host = el.querySelector('ft-empty-state') as HTMLElement;
    expect(host.getAttribute('role')).toBe('alert');
    expect(host.classList.contains('ft-empty--error')).toBe(true);
  });

  it('can be the page heading when the empty state is the whole page', () => {
    const { fixture, cmp, el } = setup();
    cmp.level.set(1);
    fixture.detectChanges();
    expect(el.querySelector('h1')?.textContent).toBe('No contacts yet');
    expect(el.querySelector('h2')).toBeNull();
  });

  it('honours the heading level', () => {
    const { fixture, cmp, el } = setup();
    cmp.level.set(3);
    fixture.detectChanges();
    expect(el.querySelector('h3')).not.toBeNull();
    expect(el.querySelector('h2')).toBeNull();
  });

  // docs/design-system/components/empty-state.html, Small: stands in for a short list inside a dialog step.
  it('has a small size that is announced as a status and draws a smaller icon', () => {
    const fixture = TestBed.createComponent(SmallHostComponent);
    fixture.detectChanges();
    const host = (fixture.nativeElement as HTMLElement).querySelector('ft-empty-state')!;
    expect(host.classList).toContain('ft-empty--sm');
    expect(host.getAttribute('role')).toBe('status');
    expect(host.querySelector('ft-icon')?.classList).toContain('ft-icon--md');
  });

  it('is medium by default', () => {
    const { el } = setup();
    const host = el.querySelector('ft-empty-state')!;
    expect(host.classList).not.toContain('ft-empty--sm');
    expect(host.querySelector('ft-icon')?.classList).toContain('ft-icon--lg');
  });
});
