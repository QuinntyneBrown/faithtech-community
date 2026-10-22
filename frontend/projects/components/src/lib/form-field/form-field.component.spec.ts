import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FormErrorFocusDirective } from '../form-error-focus';
import { TextFieldComponent } from '../text-field/text-field.component';
import { FormFieldComponent, FormFieldWidth } from './form-field.component';

@Component({
  imports: [FormFieldComponent, TextFieldComponent, FormErrorFocusDirective, ReactiveFormsModule],
  template: `<form ftFormErrorFocus>
    <ft-form-field label="Email" [error]="error()">
      <ft-text-field [formControl]="ctrl" />
    </ft-form-field>
  </form>`,
})
class FocusFormHostComponent {
  readonly error = signal('');
  readonly ctrl = new FormControl('');
}

@Component({
  imports: [FormFieldComponent, TextFieldComponent, ReactiveFormsModule],
  template: `<ft-form-field
    [label]="label()"
    [optional]="optional()"
    [required]="required()"
    [help]="help()"
    [error]="error()"
    [width]="width()"
    [labelHidden]="labelHidden()"
  >
    <ft-text-field [formControl]="ctrl" />
  </ft-form-field>`,
})
class HostComponent {
  readonly label = signal('Email');
  readonly optional = signal(false);
  readonly required = signal(false);
  readonly help = signal('');
  readonly error = signal('');
  readonly width = signal<FormFieldWidth>('auto');
  readonly labelHidden = signal(false);
  readonly ctrl = new FormControl('');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(s: string) => host.querySelector<T>(s);
  return { fixture, host, cmp: fixture.componentInstance, q };
}

describe('FormFieldComponent', () => {
  it('announces errors through a polite live region that is there before any error', () => {
    const { fixture, cmp, q } = setup();
    const region = q<HTMLElement>('[aria-live="polite"]')!;
    expect(region).toBeTruthy();
    expect(region.textContent!.trim()).toBe('');
    cmp.error.set('Enter an email like name@example.org.');
    fixture.detectChanges();
    expect(q('[aria-live="polite"]')).toBe(region);
    expect(region.querySelector('ft-inline-message')!.textContent).toContain('Enter an email');
    cmp.error.set('');
    fixture.detectChanges();
    expect(region.textContent!.trim()).toBe('');
  });

  it('leaves announcing to focus inside a form that moves focus to its errors', () => {
    const fixture = TestBed.createComponent(FocusFormHostComponent);
    fixture.componentInstance.error.set('Enter an email.');
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('ft-inline-message')).toBeTruthy();
    expect(host.querySelector('[aria-live]')).toBeNull();
  });

  it('announces the control as required only when the field is required', () => {
    const { fixture, cmp, q } = setup();
    expect(q('input')!.getAttribute('aria-required')).toBeNull();
    cmp.required.set(true);
    fixture.detectChanges();
    expect(q('input')!.getAttribute('aria-required')).toBe('true');
    // Validation stays with the page: no native required, so no browser bubble blocks submit.
    expect(q<HTMLInputElement>('input')!.required).toBe(false);
  });

  it('shows a visible label tied to the control by for/id', () => {
    const { q } = setup();
    const label = q<HTMLLabelElement>('label')!;
    const input = q<HTMLInputElement>('input')!;
    expect(label.textContent).toContain('Email');
    expect(input.id).toBeTruthy();
    expect(label.htmlFor).toBe(input.id);
  });

  it('can hide the label visually while keeping it as the accessible name', () => {
    const { fixture, cmp, q } = setup();
    cmp.labelHidden.set(true);
    fixture.detectChanges();
    const label = q<HTMLLabelElement>('label')!;
    expect(label.classList.contains('visually-hidden')).toBe(true);
    expect(label.htmlFor).toBe(q<HTMLInputElement>('input')!.id);
  });

  it('marks optional fields in the label and required ones not', () => {
    const { fixture, cmp, q } = setup();
    expect(q('label')!.textContent).not.toContain('(optional)');
    cmp.optional.set(true);
    fixture.detectChanges();
    expect(q('label')!.textContent).toContain('(optional)');
  });

  it('links help text to the control with aria-describedby', () => {
    const { fixture, cmp, q } = setup();
    expect(q('input')!.getAttribute('aria-describedby')).toBeNull();
    cmp.help.set('Leave empty for no limit.');
    fixture.detectChanges();
    const help = q('.field__help')!;
    expect(help.textContent).toContain('Leave empty for no limit.');
    expect(q('input')!.getAttribute('aria-describedby')).toBe(help.id);
  });

  it('shows an error, marks the control invalid and describes it', () => {
    const { fixture, cmp, q } = setup();
    cmp.help.set('Help');
    cmp.error.set('Enter an email.');
    fixture.detectChanges();
    const input = q('input')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    expect(ids).toHaveLength(2);
    expect(q('ft-inline-message')!.textContent).toContain('Enter an email.');
    expect(ids).toContain(q('ft-inline-message')!.id);
  });

  it('is not invalid without an error', () => {
    const { q } = setup();
    expect(q('input')!.getAttribute('aria-invalid')).toBeNull();
  });

  // Given a filter select in a filter row, when it takes a filter width, then the field is held to
  // that width (sm 12rem, md 14rem, lg 16rem) by a class, never by an inline wrapper.
  it.each(['sm', 'md', 'lg'] as const)('holds a filter field to the %s width', (w) => {
    const { fixture, cmp } = setup();
    cmp.width.set(w);
    fixture.detectChanges();
    const field = fixture.nativeElement.querySelector('ft-form-field') as HTMLElement;
    expect(field.classList.contains(`ft-form-field--${w}`)).toBe(true);
  });

  it('takes the width of its container by default', () => {
    const { fixture } = setup();
    const field = fixture.nativeElement.querySelector('ft-form-field') as HTMLElement;
    expect(field.className).not.toMatch(/ft-form-field--/);
  });
});
