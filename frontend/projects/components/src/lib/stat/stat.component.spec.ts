import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StatComponent } from './stat.component';

@Component({
  imports: [StatComponent],
  template: `<ft-stat label="Completed points" value="6 of 24" />`,
})
class HostComponent {}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('StatComponent', () => {
  it('shows the label and the value', () => {
    const el = setup();
    expect(el.querySelector('.ft-stat__label')?.textContent).toBe('Completed points');
    expect(el.querySelector('.ft-stat__value')?.textContent).toBe('6 of 24');
  });

  it('reads as one group so the value keeps its label', () => {
    const host = setup().querySelector('ft-stat') as HTMLElement;
    expect(host.getAttribute('role')).toBe('group');
    const labelId = host.getAttribute('aria-labelledby');
    expect(host.querySelector(`#${labelId}`)?.textContent).toBe('Completed points');
  });

  it('keeps the label before the value in DOM order', () => {
    const spans = Array.from(setup().querySelectorAll('ft-stat span')) as HTMLElement[];
    expect(spans[0].classList.contains('ft-stat__label')).toBe(true);
  });
});
