import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EmojiPickerComponent } from './emoji-picker.component';

@Component({
  imports: [ReactiveFormsModule, EmojiPickerComponent],
  template: `<ft-emoji-picker legend="Icon" [formControl]="icon" />`,
})
class HostComponent {
  readonly icon = new FormControl<string | null>('💡');
}

describe('EmojiPickerComponent', () => {
  it('is a radio group of named emoji with No icon, writing the chosen emoji', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const radio = (name: string) =>
      Array.from(el.querySelectorAll<HTMLInputElement>('input[type=radio]')).find(
        (r) => (r.getAttribute('aria-label') ?? r.parentElement?.textContent?.trim()) === name,
      )!;

    expect(el.querySelector('[role=radiogroup] legend')?.textContent).toBe('Icon');
    expect(radio('Light bulb').checked).toBe(true);
    radio('Compass').click();
    expect(fixture.componentInstance.icon.value).toBe('🧭');
    radio('No icon').click();
    expect(fixture.componentInstance.icon.value).toBeNull();
  });
});
