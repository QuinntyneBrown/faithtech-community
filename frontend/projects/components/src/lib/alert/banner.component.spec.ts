import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertStatus } from './alert.component';
import { BannerComponent } from './banner.component';

@Component({
  imports: [BannerComponent],
  template: `
    <ft-banner
      [status]="status()"
      heading="Verify your email to RSVP"
      [dismissible]="dismissible()"
      (dismissed)="dismissals = dismissals + 1"
    >
      We sent a link to leah@example.org.
      <button ftAlertActions type="button">Send again</button>
    </ft-banner>
  `,
})
class HostComponent {
  status = signal<AlertStatus>('warning');
  dismissible = signal(false);
  dismissals = 0;
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, banner: () => host.querySelector('.alert') as HTMLElement };
}

describe('BannerComponent', () => {
  it('renders as a full-width banner with heading, text and actions', () => {
    const { host, banner } = setup();
    expect(banner().classList).toContain('banner');
    expect(host.querySelector('.alert__title')?.textContent).toContain('Verify your email to RSVP');
    expect(host.querySelector('.alert__text')?.textContent).toContain('We sent a link');
    expect(host.querySelector('.alert__actions button')?.textContent).toBe('Send again');
  });

  it('maps status to variant class and role', () => {
    const { fixture, banner } = setup();
    expect(banner().classList).toContain('alert--warning');
    expect(banner().getAttribute('role')).toBe('status');
    fixture.componentInstance.status.set('danger');
    fixture.detectChanges();
    expect(banner().getAttribute('role')).toBe('alert');
  });

  it('is persistent unless dismissible, then emits dismissed', () => {
    const { fixture, host } = setup();
    expect(host.querySelector('button[aria-label="Dismiss"]')).toBeNull();
    fixture.componentInstance.dismissible.set(true);
    fixture.detectChanges();
    (host.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.dismissals).toBe(1);
  });
});
