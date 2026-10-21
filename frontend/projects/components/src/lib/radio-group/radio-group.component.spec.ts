import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RadioGroupComponent } from './radio-group.component';
import { RadioComponent } from './radio.component';

@Component({
  imports: [RadioGroupComponent, RadioComponent, ReactiveFormsModule],
  template: `<ft-radio-group legend="Format" name="fmt" [formControl]="ctrl" [error]="error">
    <ft-radio value="in-person">In person</ft-radio>
    <ft-radio value="online" description="We will show the link">Online</ft-radio>
  </ft-radio-group>`,
})
class HostComponent {
  ctrl = new FormControl('in-person');
  error = '';
}

describe('RadioGroupComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const radios = () => Array.from(host.querySelectorAll<HTMLInputElement>('input[type=radio]'));
    return { fixture, cmp: fixture.componentInstance, host, radios };
  }

  it('is a fieldset with a legend and native radios sharing a name', () => {
    const { host, radios } = setup();
    expect(host.querySelector('fieldset > legend')!.textContent).toContain('Format');
    expect(radios().map((r) => r.name)).toEqual(['fmt', 'fmt']);
  });

  it('checks the radio matching the value', () => {
    const { radios } = setup();
    expect(radios().map((r) => r.checked)).toEqual([true, false]);
  });

  it('shows the option description', () => {
    expect(setup().host.textContent).toContain('We will show the link');
  });

  it('selecting an option updates the control', () => {
    const { fixture, cmp, radios } = setup();
    radios()[1].click();
    fixture.detectChanges();
    expect(cmp.ctrl.value).toBe('online');
    expect(radios().map((r) => r.checked)).toEqual([false, true]);
  });

  it('disables every radio with the control', () => {
    const { fixture, cmp, radios } = setup();
    cmp.ctrl.disable();
    fixture.detectChanges();
    expect(radios().every((r) => r.disabled)).toBe(true);
  });

  it('shows a group error described by the fieldset', () => {
    const { fixture, cmp, host } = setup();
    cmp.error = 'Choose a role to add.';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const fs = host.querySelector('fieldset')!;
    const msg = host.querySelector('ft-inline-message')!;
    expect(msg.textContent).toContain('Choose a role to add.');
    expect(fs.getAttribute('aria-describedby')).toBe(msg.id);
    expect(fs.getAttribute('aria-invalid')).toBe('true');
  });
});
