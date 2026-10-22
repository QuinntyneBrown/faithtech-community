import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

@Component({
  imports: [ButtonComponent],
  template: `<ft-button
    [variant]="variant()"
    [size]="size()"
    [type]="type()"
    [disabled]="disabled()"
    [loading]="loading()"
    [block]="block()"
    [iconOnly]="iconOnly()"
    [label]="label()"
    [href]="href()"
    [object]="object()"
    [initialFocus]="initialFocus()"
    >Publish event</ft-button
  >`,
})
class HostComponent {
  variant = signal<'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'google'>('secondary');
  size = signal<'sm' | 'md' | 'lg'>('md');
  type = signal<'button' | 'submit' | 'reset'>('button');
  disabled = signal(false);
  loading = signal(false);
  block = signal(false);
  iconOnly = signal(false);
  label = signal<string | null>(null);
  href = signal<string | null>(null);
  object = signal<string | null>(null);
  initialFocus = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(s: string) => host.querySelector(s) as T;
  return { fixture, host, cmp: fixture.componentInstance, q };
}

describe('ButtonComponent', () => {
  it('offers the accent outline variant used by the person card', () => {
    const { fixture, cmp, q } = setup();
    cmp.variant.set('outline');
    fixture.detectChanges();
    expect(q('button').classList.contains('ft-button--outline')).toBe(true);
  });

  it('renders a native button with the projected label as its name', () => {
    const { q } = setup();
    const btn = q<HTMLButtonElement>('button');
    expect(btn.textContent).toContain('Publish event');
    expect(btn.type).toBe('button');
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)('applies the %s variant', (v) => {
    const { fixture, cmp, q } = setup();
    cmp.variant.set(v);
    fixture.detectChanges();
    expect(q('button').classList.contains(`ft-button--${v}`)).toBe(true);
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size', (s) => {
    const { fixture, cmp, q } = setup();
    cmp.size.set(s);
    fixture.detectChanges();
    expect(q('button').classList.contains(`ft-button--${s}`)).toBe(true);
  });

  it('supports submit type', () => {
    const { fixture, cmp, q } = setup();
    cmp.type.set('submit');
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('button').type).toBe('submit');
  });

  it('disables the native button', () => {
    const { fixture, cmp, q } = setup();
    cmp.disabled.set(true);
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('button').disabled).toBe(true);
  });

  it('is busy and aria-disabled while loading', () => {
    const { fixture, cmp, q } = setup();
    cmp.loading.set(true);
    fixture.detectChanges();
    const btn = q<HTMLButtonElement>('button');
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('is not busy by default', () => {
    const { q } = setup();
    expect(q('button').getAttribute('aria-busy')).toBeNull();
  });

  it('fills the width as a block button', () => {
    const { fixture, cmp, q } = setup();
    cmp.block.set(true);
    fixture.detectChanges();
    expect(q('button').classList.contains('ft-button--block')).toBe(true);
  });

  it('labels an icon-only button with aria-label', () => {
    const { fixture, cmp, q } = setup();
    cmp.iconOnly.set(true);
    cmp.label.set('Close');
    fixture.detectChanges();
    const btn = q('button');
    expect(btn.classList.contains('ft-button--icon')).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Close');
  });

  it('names a repeated row action with a visually hidden object, not aria-label', () => {
    const { fixture, cmp, q } = setup();
    cmp.object.set('Toronto Builders Night');
    fixture.detectChanges();
    const btn = q('button');
    expect(btn.querySelector('.ft-button__object')!.textContent).toBe(' Toronto Builders Night');
    expect(btn.textContent!.trim()).toBe('Publish event Toronto Builders Night');
    expect(btn.getAttribute('aria-label')).toBeNull();
  });

  it('keeps the visually hidden object on a link styled as a button', () => {
    const { fixture, cmp, q } = setup();
    cmp.href.set('/events');
    cmp.object.set('Toronto Builders Night');
    fixture.detectChanges();
    expect(q('a').querySelector('.ft-button__object')!.textContent).toBe(' Toronto Builders Night');
  });

  it('renders a link styled as a button when href is set', () => {
    const { fixture, cmp, q } = setup();
    cmp.href.set('/events');
    fixture.detectChanges();
    expect(q('button')).toBeNull();
    const a = q<HTMLAnchorElement>('a');
    expect(a.getAttribute('href')).toBe('/events');
    expect(a.textContent).toContain('Publish event');
    expect(a.classList.contains('ft-button')).toBe(true);
  });

  it('keeps a disabled link out of the tab order and marks it aria-disabled', () => {
    const { fixture, cmp, q } = setup();
    cmp.href.set('/events');
    cmp.disabled.set(true);
    fixture.detectChanges();
    const a = q('a');
    expect(a.getAttribute('aria-disabled')).toBe('true');
    expect(a.getAttribute('tabindex')).toBe('-1');
  });

  it('marks the native button as the dialog’s first focus when initialFocus is set', () => {
    const { fixture, cmp, q } = setup();
    expect(q('button').hasAttribute('cdkFocusInitial')).toBe(false);
    cmp.initialFocus.set(true);
    fixture.detectChanges();
    expect(q('button').hasAttribute('cdkFocusInitial')).toBe(true);
  });

  it('lets clicks reach the host listener', () => {
    const { q } = setup();
    const spy = vi.fn();
    q('ft-button').addEventListener('click', spy);
    q<HTMLButtonElement>('button').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not let a click through while loading', () => {
    const { fixture, cmp, q } = setup();
    cmp.loading.set(true);
    fixture.detectChanges();
    const spy = vi.fn();
    q('ft-button').addEventListener('click', spy);
    q<HTMLButtonElement>('button').click();
    expect(spy).not.toHaveBeenCalled();
  });

  // Traces to: L2-071
  it("shows Google's mark before the label on the Google variant, decorative to screen readers", () => {
    const { fixture, cmp, q } = setup();
    expect(q('img')).toBeNull();

    cmp.variant.set('google');
    fixture.detectChanges();

    const button = q<HTMLButtonElement>('button');
    expect(button.classList).toContain('ft-button--google');
    expect(q('img')?.getAttribute('alt')).toBe('');
    expect(button.textContent?.trim()).toBe('Publish event');
  });
});
