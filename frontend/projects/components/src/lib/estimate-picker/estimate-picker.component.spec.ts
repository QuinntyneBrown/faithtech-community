import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EstimateOption, EstimatePickerComponent } from './estimate-picker.component';

@Component({
  imports: [EstimatePickerComponent],
  template: `<ft-estimate-picker
    label="Your vote"
    [options]="options()"
    [(value)]="value"
    [disabled]="disabled()"
    [invalid]="invalid()"
    [error]="error()"
  />`,
})
class HostComponent {
  options = signal<EstimateOption[]>([1, 2, 3, 5, 8, 13, 21, '?']);
  value = signal<EstimateOption | null>(null);
  disabled = signal(false);
  invalid = signal(false);
  error = signal('');
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const buttons = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button'));
  return { fixture, cmp: fixture.componentInstance, host, buttons };
}

describe('EstimatePickerComponent', () => {
  it('is a group named by its label', () => {
    const { host } = setup();
    const group = host.querySelector('[role="group"]')!;
    const labelId = group.getAttribute('aria-labelledby')!;
    expect(host.querySelector('#' + labelId)!.textContent).toContain('Your vote');
  });

  it('offers one toggle button per option, with units', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.querySelector('span')!.textContent)).toEqual([
      '1',
      '2',
      '3',
      '5',
      '8',
      '13',
      '21',
      '?',
    ]);
    expect(buttons()[4].textContent).toContain('points');
    expect(buttons()[7].textContent).toContain('Unsure');
    expect(buttons().every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('follows a custom scale', () => {
    const { fixture, cmp, buttons } = setup();
    cmp.options.set([1, 2, 4]);
    fixture.detectChanges();
    expect(buttons()).toHaveLength(3);
  });

  it('votes on press and marks only that card pressed', () => {
    const { fixture, cmp, buttons } = setup();
    buttons()[4].click();
    fixture.detectChanges();
    expect(cmp.value()).toBe(8);
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('withdraws the vote when the pressed card is pressed again', () => {
    const { fixture, cmp, buttons } = setup();
    buttons()[4].click();
    buttons()[4].click();
    fixture.detectChanges();
    expect(cmp.value()).toBeNull();
  });

  it('locks every card but keeps the vote shown once disabled', () => {
    const { fixture, cmp, buttons } = setup();
    buttons()[2].click();
    cmp.disabled.set(true);
    fixture.detectChanges();
    expect(buttons().every((b) => b.disabled)).toBe(true);
    expect(buttons()[2].getAttribute('aria-pressed')).toBe('true');
    buttons()[3].click();
    expect(cmp.value()).toBe(3);
  });

  it('flags the group invalid when a vote was refused', () => {
    const { fixture, cmp, host } = setup();
    cmp.invalid.set(true);
    fixture.detectChanges();
    expect(host.querySelector('[role="group"]')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows why a vote was refused in a message that describes the group', () => {
    const { fixture, cmp, host } = setup();
    expect(host.querySelector('ft-inline-message')).toBeNull();
    expect(host.querySelector('[role="group"]')!.hasAttribute('aria-describedby')).toBe(false);
    cmp.error.set('Voting has closed on this story. Your vote wasn’t counted.');
    fixture.detectChanges();
    const group = host.querySelector('[role="group"]')!;
    const msg = host.querySelector('ft-inline-message')!;
    expect(msg.textContent).toContain('Voting has closed on this story.');
    expect(group.getAttribute('aria-describedby')).toBe(msg.id);
    expect(group.getAttribute('aria-invalid')).toBe('true');
  });
});
