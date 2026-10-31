import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FormFieldComponent } from '../form-field/form-field.component';
import { TextFieldComponent } from './text-field.component';

@Component({
  imports: [TextFieldComponent, ReactiveFormsModule],
  template: `<ft-text-field
    [formControl]="ctrl"
    [type]="type"
    [action]="action"
    [readonly]="readonly"
    [size]="size"
    [initialFocus]="initialFocus"
    [inputId]="inputId"
    label="Field"
    (actionClick)="clicks = clicks + 1"
  />`,
})
class HostComponent {
  ctrl = new FormControl('start');
  type = 'text';
  action: 'reveal' | 'copy' | null = null;
  readonly = false;
  size: 'sm' | 'md' | 'lg' = 'md';
  inputId: string | null = null;
  initialFocus = false;
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

  it('renders the medium size by default', () => {
    const { input } = setup();
    expect(input().classList).not.toContain('input--sm');
    expect(input().classList).not.toContain('input--lg');
  });

  it('renders the small and large design-system sizes', () => {
    expect(setup({ size: 'sm' }).input().classList).toContain('input--sm');
    TestBed.resetTestingModule();
    expect(setup({ size: 'lg' }).input().classList).toContain('input--lg');
  });

  it('uses the given input id when there is no ft-form-field', () => {
    expect(setup({ inputId: 'global-q' }).input().id).toBe('global-q');
  });

  it("marks the input as the dialog's first focus only when asked", () => {
    expect(setup().input().hasAttribute('cdkFocusInitial')).toBe(false);
    TestBed.resetTestingModule();
    expect(setup({ initialFocus: true }).input().hasAttribute('cdkFocusInitial')).toBe(true);
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

// Traces to: Log activity date and next step (components/text-field.html; textarea.html counter).
// Given the activity date field, When min and max are set, Then the native date input carries
// them (the date capped at today). Given the Next step field with a maxlength, When typing, Then
// a counter under the field says how many characters are left, or too many, without cutting
// text off, and describes the input before the help.
@Component({
  imports: [TextFieldComponent],
  template: `<ft-text-field type="date" label="Date" min="2026-01-01" max="2026-10-22" />`,
})
class DateHostComponent {}

@Component({
  imports: [TextFieldComponent, FormFieldComponent, ReactiveFormsModule],
  template: `<ft-form-field label="Next step" help="Optional.">
    <ft-text-field [formControl]="ctrl" [maxlength]="10" />
  </ft-form-field>`,
})
class CountedHostComponent {
  ctrl = new FormControl('abc');
}

describe('TextFieldComponent min and max', () => {
  it('passes min and max to the native input', () => {
    const fixture = TestBed.createComponent(DateHostComponent);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(input.getAttribute('min')).toBe('2026-01-01');
    expect(input.getAttribute('max')).toBe('2026-10-22');
  });

  it('sets neither by default', () => {
    const input = setup().input();
    expect(input.hasAttribute('min')).toBe(false);
    expect(input.hasAttribute('max')).toBe(false);
  });
});

describe('TextFieldComponent with a maxlength', () => {
  function setupCounted() {
    const fixture = TestBed.createComponent(CountedHostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const el = () => host.querySelector('input')!;
    const count = () => host.querySelector<HTMLElement>('.field__count');
    const type = (value: string) => {
      el().value = value;
      el().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { host, el, count, type };
  }

  it('counts the characters left under the field', () => {
    const { count, type } = setupCounted();
    expect(count()!.textContent!.trim()).toBe('7 characters left');
    type('abcdefghi');
    expect(count()!.textContent!.trim()).toBe('1 character left');
  });

  it('says how many too many once over, in the over style, without cutting text', () => {
    const { el, count, type } = setupCounted();
    type('abcdefghijkl');
    expect(el().value).toBe('abcdefghijkl');
    expect(el().hasAttribute('maxlength')).toBe(false);
    expect(count()!.textContent!.trim()).toBe('2 characters too many');
    expect(count()!.classList).toContain('field__count--over');
  });

  it('describes the input with the counter before the help', () => {
    const { host, el, count } = setupCounted();
    const help = host.querySelector('.field__help')!;
    expect(el().getAttribute('aria-describedby')).toBe(`${count()!.id} ${help.id}`);
  });

  it('shows no counter without a maxlength', () => {
    const { input } = setup();
    expect(input().closest('ft-text-field')!.querySelector('.field__count')).toBeNull();
  });
});
