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

  // Given a stat whose value is words (a sprint goal, an end date), when it renders, then the
  // value takes the smaller text style through a modifier rather than an inline font override.
  it('sets a text value smaller through the text variant', () => {
    const fixture = TestBed.createComponent(StatComponent);
    fixture.componentRef.setInput('label', 'Sprint goal');
    fixture.componentRef.setInput('value', 'Hackathon ready for registration');
    fixture.componentRef.setInput('variant', 'text');
    fixture.detectChanges();
    const value = (fixture.nativeElement as HTMLElement).querySelector('.ft-stat__value')!;
    expect(value.classList.contains('ft-stat__value--text')).toBe(true);
    expect(value.getAttribute('style')).toBeNull();
  });

  it('keeps the large number style by default', () => {
    const value = setup().querySelector('.ft-stat__value')!;
    expect(value.classList.contains('ft-stat__value--text')).toBe(false);
  });
});
