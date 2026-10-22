import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { FormFieldComponent } from '../form-field/form-field.component';
import { TagInputComponent, TagSuggestion } from './tag-input.component';

@Component({
  imports: [TagInputComponent, FormFieldComponent, ReactiveFormsModule],
  template: `<ft-form-field label="Tags" help="Press Enter or comma to add.">
    <ft-tag-input [formControl]="ctrl" [suggestions]="suggestions" (query)="typed = $event" />
  </ft-form-field>`,
})
class HostComponent {
  ctrl = new FormControl<string[]>(['brand'], { nonNullable: true });
  suggestions: TagSuggestion[] = [
    { name: 'launch', count: 6 },
    { name: 'brand', count: 2 },
  ];
  typed = '';
}

describe('TagInputComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const field = host.querySelector<HTMLInputElement>('input[role=combobox]')!;
    const type = (value: string) => {
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const key = (k: string) => {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
      fixture.detectChanges();
    };
    return { fixture, host, field, type, key, cmp: fixture.componentInstance };
  }

  it('is labelled by its field and shows the chosen tags as removable chips', () => {
    const { host, field } = setup();
    expect(host.querySelector('label')!.htmlFor).toBe(field.id);
    expect(host.querySelector('[aria-label="Remove tag brand"]')).not.toBeNull();
  });

  it('suggests tags in use with their usage, and offers a new tag', () => {
    const { host, field, type, cmp } = setup();
    type('LAU');
    const options = Array.from(host.querySelectorAll('[role=option]')).map((o) =>
      o.textContent!.trim(),
    );
    expect(cmp.typed).toBe('lau');
    expect(field.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[role=listbox]')!.getAttribute('aria-label')).toBe(
      'Tags already in use',
    );
    expect(options[0]).toContain('launch');
    expect(options[0]).toContain('Used on 6 resources');
    expect(options[1]).toBe('Add “lau” as a new tag');
  });

  it('adds the active suggestion on Enter, lower-cased and once', () => {
    const { type, key, cmp } = setup();
    type('lau');
    key('Enter');
    type(' Brand ');
    key('ArrowDown');
    key('Enter');
    expect(cmp.ctrl.value).toEqual(['brand', 'launch']);
  });

  it('adds typed tags on comma and removes the last on Backspace', () => {
    const { type, key, cmp } = setup();
    type('Events, hackathon,');
    expect(cmp.ctrl.value).toEqual(['brand', 'events', 'hackathon']);
    key('Backspace');
    expect(cmp.ctrl.value).toEqual(['brand', 'events']);
  });
});
