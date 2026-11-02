import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PickerRowComponent, PickerRowType } from './picker-row.component';

@Component({
  imports: [PickerRowComponent],
  template: `<ft-picker-row
      [type]="type()"
      name="rp"
      value="r1"
      [checked]="true"
      thumbnailSrc="/files/1/thumbnail"
      title="SoCal parking, on site"
      meta="Image · JPG · Grace Okonkwo · Tue 20 Oct"
      (changed)="changes.push($event)"
    /><ft-picker-row
      [type]="type()"
      name="rp"
      value="r2"
      title="Volunteer training: welcome and safety"
      meta="PDF · 18 pages · Daniel Reyes · Fri 3 Oct"
      (changed)="changes.push($event)"
    />`,
})
class HostComponent {
  type = signal<PickerRowType>('radio');
  changes: boolean[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const rows = Array.from(el.querySelectorAll<HTMLElement>('ft-picker-row'));
  const input = (row: HTMLElement) => row.querySelector('input') as HTMLInputElement;
  return { fixture, el, rows, input };
}

// docs/design-system/components/picker-row.html: one choice in a choose-from-list dialog.
describe('PickerRowComponent', () => {
  it('is a list row holding a native input labelled by its title and meta', () => {
    const { rows, input } = setup();
    const [first] = rows;
    expect(first.getAttribute('role')).toBe('listitem');
    const box = input(first);
    expect(box.type).toBe('radio');
    expect(box.name).toBe('rp');
    expect(box.value).toBe('r1');
    expect(box.checked).toBe(true);
    const label = box.closest('label') as HTMLLabelElement;
    expect(label).not.toBeNull();
    expect(label.querySelector('.ft-picker-row__title')?.textContent?.trim()).toBe(
      'SoCal parking, on site',
    );
    expect(label.querySelector('.ft-picker-row__meta')?.textContent?.trim()).toBe(
      'Image · JPG · Grace Okonkwo · Tue 20 Oct',
    );
    expect(input(rows[1]).checked).toBe(false);
  });

  it('shows the thumbnail, or an icon tile when there is none, hidden from assistive technology', () => {
    const { rows } = setup();
    const withThumb = rows[0].querySelector('ft-icon-tile') as HTMLElement;
    expect(withThumb.querySelector('img')?.getAttribute('src')).toBe('/files/1/thumbnail');
    expect(withThumb.getAttribute('aria-hidden')).toBe('true');
    const without = rows[1].querySelector('ft-icon-tile') as HTMLElement;
    expect(without.querySelector('img')).toBeNull();
    expect(without.querySelector('ft-icon')).not.toBeNull();
  });

  it('can be a checkbox', () => {
    const { fixture, rows, input } = setup();
    fixture.componentInstance.type.set('checkbox');
    fixture.detectChanges();
    expect(input(rows[0]).type).toBe('checkbox');
    expect(rows[0].classList).toContain('ft-picker-row--checkbox');
  });

  it('tells the caller when it is picked or cleared', () => {
    const { fixture, rows, input } = setup();
    fixture.componentInstance.type.set('checkbox');
    fixture.detectChanges();
    input(rows[1]).click();
    input(rows[1]).click();
    expect(fixture.componentInstance.changes).toEqual([true, false]);
  });
});
