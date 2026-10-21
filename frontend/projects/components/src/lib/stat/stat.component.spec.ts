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

  // Given an empty pipeline, when the stat shows a zero count, then it reads "0", never blank.
  it('shows a zero count as 0', () => {
    const fixture = TestBed.createComponent(StatComponent);
    fixture.componentRef.setInput('label', 'Lead');
    fixture.componentRef.setInput('value', 0);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ft-stat__value')?.textContent?.trim()).toBe('0');
  });

  // Given the counts are loading, when the stat renders, then its label stays and a skeleton
  // stands in for the value, and the stat is marked busy.
  it('keeps the label and shows a skeleton value while loading', () => {
    const fixture = TestBed.createComponent(StatComponent);
    fixture.componentRef.setInput('label', 'In funnel');
    fixture.componentRef.setInput('value', 3);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('.ft-stat__label')?.textContent).toBe('In funnel');
    expect(el.querySelector('ft-skeleton')).not.toBeNull();
    expect(el.querySelector('.ft-stat__value')).toBeNull();
  });

  it('keeps the large number style by default', () => {
    const value = setup().querySelector('.ft-stat__value')!;
    expect(value.classList.contains('ft-stat__value--text')).toBe(false);
  });
});
