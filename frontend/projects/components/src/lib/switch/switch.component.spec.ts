import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SwitchComponent } from './switch.component';

@Component({
  imports: [SwitchComponent, ReactiveFormsModule],
  template: `<ft-switch [formControl]="ctrl">Email me announcements</ft-switch>`,
})
class HostComponent {
  ctrl = new FormControl(true);
}

describe('SwitchComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      cmp: fixture.componentInstance,
      host,
      input: () => host.querySelector('input')!,
    };
  }

  it('is a labelled switch reflecting the value', () => {
    const { input, host } = setup();
    expect(input().getAttribute('role')).toBe('switch');
    expect(input().type).toBe('checkbox');
    expect(input().checked).toBe(true);
    expect(host.querySelector('label')!.textContent).toContain('Email me announcements');
  });

  it('toggles the control on click', () => {
    const { input, cmp } = setup();
    input().click();
    expect(cmp.ctrl.value).toBe(false);
  });

  it('marks touched on blur and disables with the control', () => {
    const { fixture, input, cmp } = setup();
    input().dispatchEvent(new Event('blur'));
    expect(cmp.ctrl.touched).toBe(true);
    cmp.ctrl.disable();
    fixture.detectChanges();
    expect(input().disabled).toBe(true);
  });
});
