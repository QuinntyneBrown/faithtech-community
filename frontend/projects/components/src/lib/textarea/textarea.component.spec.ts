import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
