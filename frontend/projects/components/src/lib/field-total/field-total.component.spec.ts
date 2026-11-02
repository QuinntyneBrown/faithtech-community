import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FieldTotalComponent } from './field-total.component';

@Component({
  imports: [FieldTotalComponent],
  template: `<ft-field-total [ok]="ok()">{{ text() }}</ft-field-total>`,
})
class HostComponent {
  ok = signal(true);
  text = signal('Weights total 100%');
}

// docs/design-system/components/inline-message.html#live-total: a form step's running sum, read when it changes.
describe('FieldTotalComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const total = (fixture.nativeElement as HTMLElement).querySelector(
      'ft-field-total',
    ) as HTMLElement;
    return { fixture, total };
  }

  it('is a polite status led by a success check when the sum is right', () => {
    const { total } = setup();
    expect(total.getAttribute('role')).toBe('status');
    expect(total.textContent?.trim()).toBe('Weights total 100%');
    expect(total.classList).not.toContain('ft-field-total--off');
    // The success icon: a check in a circle.
    expect(total.querySelector('ft-icon svg path')?.getAttribute('d')).toBe('m8 12 3 3 5-6');
  });

  it('turns to the off state with an exclamation when the sum is wrong', () => {
    const { fixture, total } = setup();
    fixture.componentInstance.ok.set(false);
    fixture.componentInstance.text.set('Weights add up to 90%');
    fixture.detectChanges();
    expect(total.classList).toContain('ft-field-total--off');
    expect(total.textContent?.trim()).toBe('Weights add up to 90%');
    // The error icon: an exclamation in a circle.
    expect(total.querySelector('ft-icon svg path')?.getAttribute('d')).toBe('M12 8v4M12 16h.01');
  });
});
