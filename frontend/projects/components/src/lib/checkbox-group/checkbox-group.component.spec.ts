import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CheckboxGroupComponent } from './checkbox-group.component';
import { CheckboxComponent } from './checkbox.component';

@Component({
  imports: [CheckboxGroupComponent, CheckboxComponent, ReactiveFormsModule],
  template: `<ft-checkbox-group
    legend="Members"
    name="wm"
    hint="Only people with a lead or volunteer role can be added."
    [formControl]="ctrl"
    [error]="error"
    [legendHidden]="hidden"
  >
    <ft-checkbox value="marcus" description="Event Lead">Marcus Lee</ft-checkbox>
    <ft-checkbox value="hannah" description="Communications Lead">Hannah Kim</ft-checkbox>
    <ft-checkbox value="ruth" description="Volunteer">Ruth Alvarez</ft-checkbox>
  </ft-checkbox-group>`,
})
class HostComponent {
  ctrl = new FormControl<string[]>(['marcus', 'ruth'], { nonNullable: true });
  error = '';
  hidden = false;
}

describe('CheckboxGroupComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const boxes = () => Array.from(host.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
    return { fixture, cmp: fixture.componentInstance, host, boxes };
  }

  it('is a fieldset with a legend and native checkboxes, never radios', () => {
    const { host, boxes } = setup();
    expect(host.querySelector('fieldset > legend')!.textContent).toContain('Members');
    expect(boxes()).toHaveLength(3);
    expect(host.querySelector('input[type=radio]')).toBeNull();
    expect(boxes().map((b) => b.name)).toEqual(['wm', 'wm', 'wm']);
    expect(boxes().map((b) => b.value)).toEqual(['marcus', 'hannah', 'ruth']);
  });

  it('describes the group with its hint', () => {
    const { host } = setup();
    const fs = host.querySelector('fieldset')!;
    const hint = host.querySelector('.ft-checkbox-group__hint')!;
    expect(hint.textContent).toContain('Only people with a lead or volunteer role');
    expect(fs.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('checks every box whose value is in the control', () => {
    const { boxes } = setup();
    expect(boxes().map((b) => b.checked)).toEqual([true, false, true]);
  });

  it('shows each option description', () => {
    expect(setup().host.textContent).toContain('Communications Lead');
  });

  it('lets several options be checked and unchecked independently', () => {
    const { fixture, cmp, boxes } = setup();
    boxes()[1].click();
    fixture.detectChanges();
    expect(cmp.ctrl.value).toEqual(['marcus', 'hannah', 'ruth']);
    boxes()[0].click();
    fixture.detectChanges();
    expect(cmp.ctrl.value).toEqual(['hannah', 'ruth']);
    expect(boxes().map((b) => b.checked)).toEqual([false, true, true]);
  });

  it('disables every checkbox with the control', () => {
    const { fixture, cmp, boxes } = setup();
    cmp.ctrl.disable();
    fixture.detectChanges();
    expect(boxes().every((b) => b.disabled)).toBe(true);
  });

  it('can hide its legend visually while keeping the group named', () => {
    const { fixture, cmp, host } = setup();
    expect(host.querySelector('legend')!.classList.contains('visually-hidden')).toBe(false);
    cmp.hidden = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const legend = host.querySelector('legend')!;
    expect(legend.classList.contains('visually-hidden')).toBe(true);
    expect(legend.textContent).toContain('Members');
  });

  it('shows a group error described by the fieldset', () => {
    const { fixture, cmp, host } = setup();
    cmp.error = 'Choose at least one member.';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const fs = host.querySelector('fieldset')!;
    const hint = host.querySelector('.ft-checkbox-group__hint')!;
    const msg = host.querySelector('ft-inline-message')!;
    expect(msg.textContent).toContain('Choose at least one member.');
    expect(fs.getAttribute('aria-describedby')).toBe(`${hint.id} ${msg.id}`);
    expect(fs.getAttribute('aria-invalid')).toBe('true');
  });

  it('marks every checkbox invalid while the group shows an error', () => {
    const { fixture, cmp, boxes } = setup();
    expect(boxes().some((b) => b.hasAttribute('aria-invalid'))).toBe(false);
    cmp.error = 'Choose at least one member.';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(boxes().every((b) => b.getAttribute('aria-invalid') === 'true')).toBe(true);
  });
});
