import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertComponent, AlertStatus } from './alert.component';

@Component({
  imports: [AlertComponent],
  template: `
    <ft-alert
      [status]="status()"
      heading="That did not work"
      [dismissible]="dismissible()"
      [focusable]="focusable()"
      (dismissed)="dismissals = dismissals + 1"
    >
      We could not reach FaithTech.
      <button ftAlertActions type="button">Try again</button>
    </ft-alert>
  `,
})
class HostComponent {
  status = signal<AlertStatus>('danger');
  dismissible = signal(false);
  focusable = signal(false);
  dismissals = 0;
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, alert: () => host.querySelector('.alert') as HTMLElement };
}

describe('AlertComponent', () => {
  it('renders the heading, projected text and projected actions', () => {
    const { host } = setup();
    expect(host.querySelector('.alert__title')?.textContent).toContain('That did not work');
    expect(host.querySelector('.alert__text')?.textContent).toContain(
      'We could not reach FaithTech.',
    );
    expect(host.querySelector('.alert__actions button')?.textContent).toBe('Try again');
  });

  it('announces danger alerts assertively with role=alert', () => {
    const { alert } = setup();
    expect(alert().getAttribute('role')).toBe('alert');
  });

  it.each(['info', 'success', 'warning'] as const)('uses role=status for %s', (status) => {
    const { fixture, alert } = setup();
    fixture.componentInstance.status.set(status);
    fixture.detectChanges();
    expect(alert().getAttribute('role')).toBe('status');
    expect(alert().classList).toContain(`alert--${status}`);
  });

  it('hides the status icon from assistive technology', () => {
    const { host } = setup();
    expect(host.querySelector('ft-icon svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('can take programmatic focus as a form error summary', () => {
    const { fixture, alert } = setup();
    expect(alert().hasAttribute('tabindex')).toBe(false);

    fixture.componentInstance.focusable.set(true);
    fixture.detectChanges();

    expect(alert().getAttribute('tabindex')).toBe('-1');
  });

  it('has no dismiss button unless dismissible', () => {
    const { host } = setup();
    expect(host.querySelector('button[aria-label="Dismiss"]')).toBeNull();
  });

  it('emits dismissed from the dismiss button', () => {
    const { fixture, host } = setup();
    fixture.componentInstance.dismissible.set(true);
    fixture.detectChanges();
    (host.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.dismissals).toBe(1);
  });
});
