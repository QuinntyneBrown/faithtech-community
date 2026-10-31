import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ListItemComponent } from '../list/list-item.component';
import { ListComponent } from '../list/list.component';
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

  // Traces to: event check-in rows (components/switch.html, Trailing a list row;
  // components/list.html, Check-in rows).
  // Given a check-in row, When its switch trails the row with labelHidden, Then the projected
  // text "Check in Leah Thompson" is still the switch's name but visually hidden, and a disabled
  // control disables it.
  describe('trailing a list row (labelHidden)', () => {
    @Component({
      imports: [SwitchComponent, ListComponent, ListItemComponent, ReactiveFormsModule],
      template: `<ft-list label="Attendees">
        <ft-list-item label="Leah Thompson" meta="Member · Not here yet">
          <ft-switch trailing labelHidden [formControl]="ctrl">Check in Leah Thompson</ft-switch>
        </ft-list-item>
      </ft-list>`,
    })
    class RowHostComponent {
      ctrl = new FormControl(false);
    }

    function setupRow() {
      const fixture = TestBed.createComponent(RowHostComponent);
      fixture.detectChanges();
      const host: HTMLElement = fixture.nativeElement;
      return { fixture, cmp: fixture.componentInstance, host };
    }

    it('sits in the row trailing slot', () => {
      const { host } = setupRow();
      expect(host.querySelector('.ft-list-item__trailing ft-switch')).not.toBeNull();
    });

    it('keeps the projected text as the name but hides it visually', () => {
      const { host } = setupRow();
      const label = host.querySelector('label')!;
      const text = label.querySelector('.text')!;
      expect(label.contains(host.querySelector('input'))).toBe(true);
      expect(text.textContent?.trim()).toBe('Check in Leah Thompson');
      expect(text.classList.contains('visually-hidden')).toBe(true);
    });

    it('is disabled with the control, such as for Staff or a cancelled event', () => {
      const { fixture, cmp, host } = setupRow();
      cmp.ctrl.disable();
      fixture.detectChanges();
      expect(host.querySelector('input')!.disabled).toBe(true);
    });
  });

  // Traces to: design system, switch (Labelling: a related caption is joined with aria-describedby);
  // L2-120 (Add walk-in dialog, "Check them in now").
  // Given a switch with a description, When it renders, Then the description shows as caption text
  // outside the label (so it is not part of the name) and the input is described by it.
  describe('with a description', () => {
    @Component({
      imports: [SwitchComponent, ReactiveFormsModule],
      template: `<ft-switch
        [formControl]="ctrl"
        description="Adds them to the attendance list as present."
        >Check them in now</ft-switch
      >`,
    })
    class DescribedHostComponent {
      ctrl = new FormControl(true);
    }

    it('shows the caption and joins it to the switch with aria-describedby', () => {
      const fixture = TestBed.createComponent(DescribedHostComponent);
      fixture.detectChanges();
      const host: HTMLElement = fixture.nativeElement;
      const input = host.querySelector('input')!;
      const id = input.getAttribute('aria-describedby');
      expect(id).toBeTruthy();
      const caption = host.querySelector(`#${id}`)!;
      expect(caption.textContent?.trim()).toBe('Adds them to the attendance list as present.');
      expect(host.querySelector('label')!.contains(caption)).toBe(false);
      expect(host.querySelector('label')!.textContent?.trim()).toBe('Check them in now');
    });

    it('gives each switch its own caption id', () => {
      const a = TestBed.createComponent(DescribedHostComponent);
      const b = TestBed.createComponent(DescribedHostComponent);
      a.detectChanges();
      b.detectChanges();
      const idA = (a.nativeElement as HTMLElement)
        .querySelector('input')!
        .getAttribute('aria-describedby');
      const idB = (b.nativeElement as HTMLElement)
        .querySelector('input')!
        .getAttribute('aria-describedby');
      expect(idA).not.toBe(idB);
    });
  });

  it('has no caption or aria-describedby without a description', () => {
    const { host, input } = setup();
    expect(input().hasAttribute('aria-describedby')).toBe(false);
    expect(host.querySelector('.description')).toBeNull();
  });

  it('shows the text by default', () => {
    const { host } = setup();
    expect(host.querySelector('.text')!.classList.contains('visually-hidden')).toBe(false);
  });
});
