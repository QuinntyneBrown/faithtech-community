import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChipComponent } from './chip.component';
import { ChipGroupComponent } from './chip-group.component';

@Component({
  imports: [ChipComponent, ChipGroupComponent],
  template: `<ft-chip-group label="Filter events">
    <ft-chip [pressed]="true">Upcoming</ft-chip>
    <ft-chip>Past</ft-chip>
  </ft-chip-group>`,
})
class HostComponent {}

describe('ChipGroupComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('ft-chip-group') as HTMLElement;
  }

  it('is a group named by its label', () => {
    const group = setup();
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Filter events');
  });

  it('holds its chips', () => {
    expect(setup().querySelectorAll('ft-chip button').length).toBe(2);
  });
});
