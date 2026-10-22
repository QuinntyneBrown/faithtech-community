import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { FormFieldComponent } from '../form-field/form-field.component';
import { PersonOption, PersonPickerComponent } from './person-picker.component';

@Component({
  imports: [PersonPickerComponent, FormFieldComponent, ReactiveFormsModule],
  template: `<ft-form-field label="Share with">
    <ft-person-picker
      [formControl]="ctrl"
      [options]="options"
      [multiple]="multiple"
      (query)="typed = $event"
    />
  </ft-form-field>`,
})
class HostComponent {
  ctrl = new FormControl<PersonOption[]>([], { nonNullable: true });
  options: PersonOption[] = [
    { id: 'p1', name: 'Daniel Reyes', detail: 'Volunteer · Austin' },
    { id: 'p2', name: 'Dana Wu', detail: 'City Lead · Toronto' },
  ];
  multiple = true;
  typed = '';
}

describe('PersonPickerComponent', () => {
  function setup(multiple = true) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.multiple = multiple;
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const field = host.querySelector<HTMLInputElement>('input[role=combobox]')!;
    const type = (value: string) => {
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const options = () => Array.from(host.querySelectorAll<HTMLElement>('[role=option]'));
    return { fixture, host, field, type, options, cmp: fixture.componentInstance };
  }

  it('asks for matches as the member types and lists them with their context', () => {
    const { field, type, options, cmp } = setup();
    expect(field.getAttribute('placeholder')).toBe('Search members by name');
    type('da');
    expect(cmp.typed).toBe('da');
    expect(field.getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.textContent)).toEqual([
      expect.stringContaining('Volunteer · Austin'),
      expect.stringContaining('City Lead · Toronto'),
    ]);
  });

  it('adds chosen members as removable chips and stops offering them', () => {
    const { fixture, host, type, options, cmp } = setup();
    type('da');
    options()[0].dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();
    type('da');
    expect(cmp.ctrl.value.map((p) => p.id)).toEqual(['p1']);
    expect(options()).toHaveLength(1);
    host.querySelector<HTMLButtonElement>('[aria-label="Remove Daniel Reyes"]')!.click();
    expect(cmp.ctrl.value).toEqual([]);
  });

  it('keeps one choice when not multiple', () => {
    const { fixture, type, options, cmp } = setup(false);
    type('da');
    options()[0].dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();
    type('da');
    options()[0].dispatchEvent(new MouseEvent('mousedown'));
    expect(cmp.ctrl.value.map((p) => p.id)).toEqual(['p2']);
  });
});
