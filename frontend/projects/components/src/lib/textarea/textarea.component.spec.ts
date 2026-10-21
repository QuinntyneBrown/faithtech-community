import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FormFieldComponent } from '../form-field/form-field.component';
import { TextareaComponent } from './textarea.component';

@Component({
  imports: [TextareaComponent, ReactiveFormsModule],
  template: `<ft-textarea [formControl]="ctrl" [rows]="rows" [initialFocus]="initialFocus" />`,
})
class HostComponent {
  ctrl = new FormControl('note');
  rows = 4;
  initialFocus = false;
}

describe('TextareaComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = () => (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    return { fixture, cmp: fixture.componentInstance, el };
  }

  it('writes the value and reports typing', () => {
    const { cmp, el } = setup();
    expect(el().value).toBe('note');
    el().value = 'more';
    el().dispatchEvent(new Event('input'));
    expect(cmp.ctrl.value).toBe('more');
  });

  it('marks touched on blur', () => {
    const { cmp, el } = setup();
    el().dispatchEvent(new Event('blur'));
    expect(cmp.ctrl.touched).toBe(true);
  });

  it('marks the native textarea as the dialog’s first focus when initialFocus is set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.initialFocus = true;
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    expect(el.hasAttribute('cdkFocusInitial')).toBe(true);
  });

  it('sets rows from the input', () => {
    const { el } = setup();
    expect(el().rows).toBe(4);
  });

  it('disables with the control', () => {
    const { fixture, cmp, el } = setup();
    cmp.ctrl.disable();
    fixture.detectChanges();
    expect(el().disabled).toBe(true);
  });
});

@Component({
  imports: [TextareaComponent, FormFieldComponent, ReactiveFormsModule],
  template: `<ft-form-field label="Bio" help="Up to 10 characters.">
    <ft-textarea [formControl]="ctrl" [maxlength]="10" />
  </ft-form-field>`,
})
class CountedHostComponent {
  ctrl = new FormControl('abc');
}

describe('TextareaComponent with a maxlength', () => {
  function setup() {
    const fixture = TestBed.createComponent(CountedHostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const el = () => host.querySelector('textarea')!;
    const count = () => host.querySelector<HTMLElement>('.field__count');
    const type = (value: string) => {
      el().value = value;
      el().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, host, el, count, type };
  }

  it('counts the characters left under the textarea', () => {
    const { count, type } = setup();
    expect(count()!.textContent!.trim()).toBe('7 characters left');
    type('abcdefghi');
    expect(count()!.textContent!.trim()).toBe('1 character left');
  });

  it('says how many characters too many once over, in the over style, without cutting text', () => {
    const { el, count, type } = setup();
    type('abcdefghijkl');
    expect(el().value).toBe('abcdefghijkl');
    expect(el().hasAttribute('maxlength')).toBe(false);
    expect(count()!.textContent!.trim()).toBe('2 characters too many');
    expect(count()!.classList).toContain('field__count--over');
    type('abcdefghijk');
    expect(count()!.textContent!.trim()).toBe('1 character too many');
  });

  it('describes the textarea with the counter before the help', () => {
    const { host, el, count } = setup();
    const help = host.querySelector('.field__help')!;
    expect(el().getAttribute('aria-describedby')).toBe(`${count()!.id} ${help.id}`);
    expect(count()!.hasAttribute('aria-live')).toBe(false);
  });

  it('shows no counter without a maxlength', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.field__count')).toBeNull();
  });
});
