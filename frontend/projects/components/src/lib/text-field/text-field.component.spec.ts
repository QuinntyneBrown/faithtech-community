import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TextFieldComponent } from './text-field.component';

@Component({
  imports: [TextFieldComponent, ReactiveFormsModule],
  template: `<ft-text-field
    [formControl]="ctrl"
    [type]="type"
    [action]="action"
    [readonly]="readonly"
    label="Field"
    (actionClick)="clicks = clicks + 1"
  />`,
})
class HostComponent {
  ctrl = new FormControl('start');
  type = 'text';
  action: 'reveal' | 'copy' | null = null;
  readonly = false;
  clicks = 0;
}

function setup(patch: Partial<HostComponent> = {}) {
  const fixture = TestBed.createComponent(HostComponent);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    cmp: fixture.componentInstance,
    input: () => host.querySelector('input') as HTMLInputElement,
    button: () => host.querySelector('button') as HTMLButtonElement | null,
  };
}

describe('TextFieldComponent', () => {
  it('writes the control value to the native input', () => {
    expect(setup().input().value).toBe('start');
  });

  it('reports typing to the form control and touched on blur', () => {
    const { input, cmp } = setup();
    input().value = 'hello';
    input().dispatchEvent(new Event('input'));
    expect(cmp.ctrl.value).toBe('hello');
    input().dispatchEvent(new Event('blur'));
    expect(cmp.ctrl.touched).toBe(true);
  });

  it('uses the given input type', () => {
    expect(setup({ type: 'email' }).input().type).toBe('email');
  });

  it('disables the input when the control is disabled', () => {
    const { fixture, cmp, input } = setup();
    cmp.ctrl.disable();
    fixture.detectChanges();
    expect(input().disabled).toBe(true);
  });

  it('supports readonly', () => {
    expect(setup({ readonly: true }).input().readOnly).toBe(true);
  });

  it('has no trailing button by default', () => {
    expect(setup().button()).toBeNull();
  });

  it('reveal action is a toggle: aria-pressed changes, the label stays Show password', () => {
    const { fixture, input, button } = setup({ type: 'password', action: 'reveal' });
    expect(input().type).toBe('password');
    expect(button()!.getAttribute('aria-label')).toBe('Show password');
    expect(button()!.getAttribute('aria-pressed')).toBe('false');
    button()!.click();
    fixture.detectChanges();
    expect(input().type).toBe('text');
    expect(button()!.getAttribute('aria-label')).toBe('Show password');
    expect(button()!.getAttribute('aria-pressed')).toBe('true');
  });

  it('copy action emits actionClick and is labelled', () => {
    const { cmp, button } = setup({ action: 'copy' });
    expect(button()!.getAttribute('aria-label')).toBe('Copy link');
    button()!.click();
    expect(cmp.clicks).toBe(1);
  });
});
