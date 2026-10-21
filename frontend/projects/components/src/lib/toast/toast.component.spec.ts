import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastComponent, ToastVariant } from './toast.component';

@Component({
  imports: [ToastComponent],
  template: `
    <ft-toast
      [variant]="variant()"
      heading="Invite sent"
      text="Nate has 14 days to accept."
      [actionLabel]="actionLabel()"
      [timed]="timed()"
      (action)="events.push('action')"
      (dismissed)="events.push('dismissed')"
      (paused)="events.push('paused')"
      (resumed)="events.push('resumed')"
    />
  `,
})
class HostComponent {
  variant = signal<ToastVariant>('success');
  actionLabel = signal<string | null>('View invites');
  timed = signal(true);
  events: string[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, toast: () => host.querySelector('.toast') as HTMLElement };
}

describe('ToastComponent', () => {
  it('shows heading, text and the action', () => {
    const { host } = setup();
    expect(host.querySelector('.toast__title')?.textContent).toContain('Invite sent');
    expect(host.querySelector('.toast__text')?.textContent).toContain('14 days');
    expect(host.querySelector('.toast__action')?.textContent).toContain('View invites');
  });

  it('omits the action when there is no label', () => {
    const { fixture, host } = setup();
    fixture.componentInstance.actionLabel.set(null);
    fixture.detectChanges();
    expect(host.querySelector('.toast__action')).toBeNull();
  });

  it.each(['info', 'success', 'warning', 'danger'] as const)(
    'applies the %s variant',
    (variant) => {
      const { fixture, toast } = setup();
      fixture.componentInstance.variant.set(variant);
      fixture.detectChanges();
      expect(toast().classList).toContain(`toast--${variant}`);
      expect(toast().getAttribute('role')).toBe(variant === 'danger' ? 'alert' : null);
    },
  );

  it('shows the timer bar only when timed', () => {
    const { fixture, host } = setup();
    expect(host.querySelector('.toast__progress')?.getAttribute('aria-hidden')).toBe('true');
    fixture.componentInstance.timed.set(false);
    fixture.detectChanges();
    expect(host.querySelector('.toast__progress')).toBeNull();
  });

  it('emits action and dismissed from its buttons', () => {
    const { fixture, host } = setup();
    (host.querySelector('.toast__action') as HTMLButtonElement).click();
    (host.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.events).toEqual(['action', 'dismissed']);
  });

  it('dismisses on Escape', () => {
    const { fixture, toast } = setup();
    toast().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.events).toEqual(['dismissed']);
  });

  it('pauses on hover and resumes on leave', () => {
    const { fixture, toast } = setup();
    toast().dispatchEvent(new MouseEvent('mouseenter'));
    toast().dispatchEvent(new MouseEvent('mouseleave'));
    expect(fixture.componentInstance.events).toEqual(['paused', 'resumed']);
  });
});
