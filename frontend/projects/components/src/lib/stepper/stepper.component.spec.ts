import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StepperComponent } from './stepper.component';

@Component({
  imports: [StepperComponent],
  template: `<ft-stepper [steps]="steps" [current]="current()" statusId="dlg-step" />`,
})
class HostComponent {
  steps = ['Event', 'Starting point', 'Sections', 'Done'];
  current = signal(2);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, cmp: fixture.componentInstance, el };
}

// Traces to: L2-153 AC2 (components/stepper.html).
describe('StepperComponent', () => {
  it('says which step of how many and its name, under the given id', () => {
    const { el } = setup();
    const status = el.querySelector('#dlg-step')!;
    expect(status.querySelector('.ft-stepper__count')?.textContent?.trim()).toBe('Step 2 of 4');
    expect(status.querySelector('.ft-stepper__name')?.textContent?.trim()).toBe('Starting point');
  });

  it('draws one segment per step, done before the current one, and names each for assistive tech', () => {
    const { el } = setup();
    const steps = Array.from(el.querySelectorAll('ol[aria-label="Progress"] li'));
    expect(steps.length).toBe(4);
    expect(steps.map((s) => s.textContent?.trim())).toEqual([
      'Event, done',
      'Starting point',
      'Sections',
      'Done',
    ]);
    expect(steps[0].classList.contains('ft-stepper__step--done')).toBe(true);
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    expect(steps[2].hasAttribute('aria-current')).toBe(false);
  });

  it('follows the current step', () => {
    const { fixture, cmp, el } = setup();
    cmp.current.set(4);
    fixture.detectChanges();
    expect(el.querySelector('.ft-stepper__count')?.textContent?.trim()).toBe('Step 4 of 4');
    expect(el.querySelectorAll('.ft-stepper__step--done').length).toBe(3);
  });
});
