import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TextFieldComponent } from '../text-field/text-field.component';
import { FormFieldComponent, FormFieldWidth } from './form-field.component';

@Component({
  imports: [FormFieldComponent, TextFieldComponent, ReactiveFormsModule],
  template: `<ft-form-field
    [label]="label()"
    [optional]="optional()"
    [help]="help()"
    [error]="error()"
    [width]="width()"
  >
    <ft-text-field [formControl]="ctrl" />
  </ft-form-field>`,
})
class HostComponent {
  readonly label = signal('Email');
  readonly optional = signal(false);
  readonly help = signal('');
  readonly error = signal('');
  readonly width = signal<FormFieldWidth>('auto');
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
  it('shows a visible label tied to the control by for/id', () => {
    const { q } = setup();
    const label = q<HTMLLabelElement>('label')!;
    const input = q<HTMLInputElement>('input')!;
    expect(label.textContent).toContain('Email');
    expect(input.id).toBeTruthy();
    expect(label.htmlFor).toBe(input.id);
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
