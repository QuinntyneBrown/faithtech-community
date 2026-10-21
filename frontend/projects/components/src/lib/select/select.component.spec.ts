import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, SelectOption } from './select.component';

@Component({
  imports: [SelectComponent, ReactiveFormsModule],
  template: `<ft-select [formControl]="ctrl" [options]="options" [placeholder]="placeholder" />`,
})
class HostComponent {
  ctrl = new FormControl('in-funnel');
  placeholder = '';
  options: SelectOption[] = [
    { value: 'lead', label: 'Lead' },
    { value: 'in-funnel', label: 'In funnel' },
    { value: 'confirmed', label: 'Confirmed', disabled: true },
  ];
}

describe('SelectComponent', () => {
  function setup(placeholder = '') {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.placeholder = placeholder;
    fixture.detectChanges();
    const el = () => (fixture.nativeElement as HTMLElement).querySelector('select')!;
    return { fixture, cmp: fixture.componentInstance, el };
  }

  it('is a native select with one option per item', () => {
    const { el } = setup();
    expect(Array.from(el().options).map((o) => o.textContent!.trim())).toEqual([
      'Lead',
      'In funnel',
      'Confirmed',
    ]);
    expect(el().options[2].disabled).toBe(true);
  });

  it('reflects the control value', () => {
    const { fixture, el } = setup();
    fixture.detectChanges();
    expect(el().value).toBe('in-funnel');
  });

  it('reports a change to the control', () => {
    const { cmp, el } = setup();
    el().value = 'lead';
    el().dispatchEvent(new Event('change'));
    expect(cmp.ctrl.value).toBe('lead');
  });

  it('adds a placeholder option when given', () => {
    const { el } = setup('Choose a stage');
    expect(el().options[0].textContent!.trim()).toBe('Choose a stage');
    expect(el().options[0].value).toBe('');
  });

  it('marks touched on blur and disables with the control', () => {
    const { fixture, cmp, el } = setup();
    el().dispatchEvent(new Event('blur'));
    expect(cmp.ctrl.touched).toBe(true);
    cmp.ctrl.disable();
    fixture.detectChanges();
    expect(el().disabled).toBe(true);
  });

  // Given the control is disabled, when the select renders, then it looks disabled the way a text
  // input does (subtle fill, disabled text) and shows a not-allowed cursor.
  it('styles a disabled select like a disabled input', () => {
    const { fixture, cmp, el } = setup();
    cmp.ctrl.disable();
    fixture.detectChanges();
    const style = getComputedStyle(el());
    expect(style.cursor).toBe('not-allowed');
    expect(style.backgroundColor).toBe('var(--color-bg-subtle)');
    expect(style.color).toBe('var(--color-fg-disabled)');
  });
});
