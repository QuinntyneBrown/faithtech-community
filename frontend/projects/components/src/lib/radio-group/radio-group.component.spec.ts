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

  it('announces the group error through a polite live region', () => {
    const { fixture, cmp, host } = setup();
    const region = host.querySelector<HTMLElement>('[aria-live="polite"]')!;
    expect(region).toBeTruthy();
    cmp.error = 'Choose a role to add.';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(region.textContent).toContain('Choose a role to add.');
  });

  it('marks every radio invalid while the group shows an error', () => {
    const { fixture, cmp, radios } = setup();
    expect(radios().some((r) => r.hasAttribute('aria-invalid'))).toBe(false);
    cmp.error = 'Choose a role to add.';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(radios().every((r) => r.getAttribute('aria-invalid') === 'true')).toBe(true);
  });
});

// Traces to: Log activity type choices (components/radio-group.html, Inline row of short choices).
// Given short choices such as Call, Email, Meeting and Note, When the group is inline, Then the
// radios sit in one wrapping row inside the same labelled radiogroup; by default they stack.
@Component({
  imports: [RadioGroupComponent, RadioComponent, ReactiveFormsModule],
  template: `<ft-radio-group legend="Type" [orientation]="orientation" [formControl]="ctrl">
    <ft-radio value="call">Call</ft-radio>
    <ft-radio value="email">Email</ft-radio>
  </ft-radio-group>`,
})
class OrientationHostComponent {
  ctrl = new FormControl('call');
  orientation: 'stack' | 'inline' = 'inline';
}

describe('RadioGroupComponent orientation', () => {
  function setup(orientation: 'stack' | 'inline' | null) {
    const fixture = TestBed.createComponent(OrientationHostComponent);
    if (orientation) fixture.componentInstance.orientation = orientation;
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    return { host, options: host.querySelector('.ft-radio-group__options') as HTMLElement };
  }

  it('lays short choices out inline in the same radiogroup', () => {
    const { host, options } = setup('inline');
    expect(options.classList.contains('ft-radio-group__options--inline')).toBe(true);
    expect(options.closest('fieldset')?.getAttribute('role')).toBe('radiogroup');
    expect(options.querySelectorAll('input[type=radio]').length).toBe(2);
    expect(host.querySelector('legend')?.textContent).toContain('Type');
  });

  it('stacks the choices when orientation is stack', () => {
    const { options } = setup('stack');
    expect(options.classList.contains('ft-radio-group__options--inline')).toBe(false);
  });
});

describe('RadioGroupComponent default orientation', () => {
  it('stacks by default', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const options = (fixture.nativeElement as HTMLElement).querySelector(
      '.ft-radio-group__options',
    );
    expect(options).not.toBeNull();
    expect(options!.classList.contains('ft-radio-group__options--inline')).toBe(false);
  });
});
