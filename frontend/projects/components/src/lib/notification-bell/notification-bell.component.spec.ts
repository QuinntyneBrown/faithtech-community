import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NotificationBellComponent } from './notification-bell.component';

@Component({
  imports: [NotificationBellComponent],
  template: `<ft-notification-bell [unread]="unread()" [(open)]="open">
    <div role="dialog" aria-label="Notifications">
      <button type="button" id="first">Mark all read</button>
      <a href="/notifications" id="last">See all</a>
    </div>
  </ft-notification-bell>`,
})
class HostComponent {
  unread = signal(3);
  open = signal(false);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const trigger = () => host.querySelector<HTMLButtonElement>('button.ft-notification-bell')!;
  const panel = () => document.querySelector('.cdk-overlay-container [role="dialog"]');
  const press = (target: Element, key: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };
  return { fixture, cmp: fixture.componentInstance, host, trigger, panel, press };
}

describe('NotificationBellComponent', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is a button whose name includes the unread count', () => {
    const { trigger } = setup();
    expect(trigger().getAttribute('aria-label')).toBe('Notifications, 3 unread');
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the count badge visually only', () => {
    const { host } = setup();
    const badge = host.querySelector(
      '[aria-hidden="true"].ft-badge, .ft-badge[aria-hidden="true"], ft-badge[aria-hidden="true"]',
    );
    expect(badge).not.toBeNull();
    expect(badge!.textContent!.trim()).toBe('3');
  });

  it('keeps the exact number for counts over 9', () => {
    const { fixture, cmp, trigger } = setup();
    cmp.unread.set(12);
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-label')).toBe('Notifications, 12 unread');
    expect(trigger().textContent).toContain('12');
  });

  it('has no badge and a plain name when everything is read', () => {
    const { fixture, cmp, trigger } = setup();
    cmp.unread.set(0);
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-label')).toBe('Notifications');
    expect(trigger().querySelector('ft-badge')).toBeNull();
  });

  it('opens the projected panel and moves focus to its first control', async () => {
    const { fixture, cmp, trigger, panel } = setup();
    expect(panel()).toBeNull();
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.open()).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel()).not.toBeNull();
    expect(document.activeElement!.id).toBe('first');
  });

  it('points aria-controls at the open panel and drops it when closed', async () => {
    const { fixture, trigger, panel } = setup();
    expect(trigger().hasAttribute('aria-controls')).toBe(false);
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    const id = trigger().getAttribute('aria-controls');
    expect(id).toBeTruthy();
    const controlled = document.getElementById(id!);
    expect(controlled).not.toBeNull();
    expect(controlled!.contains(panel())).toBe(true);
    trigger().click();
    fixture.detectChanges();
    expect(trigger().hasAttribute('aria-controls')).toBe(false);
  });

  it('closes on Escape and returns focus to the bell', async () => {
    const { fixture, cmp, trigger, panel, press } = setup();
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    press(panel()!, 'Escape');
    fixture.detectChanges();
    expect(cmp.open()).toBe(false);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes when the bell is pressed again', async () => {
    const { fixture, cmp, trigger } = setup();
    trigger().click();
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();
    expect(cmp.open()).toBe(false);
  });

  it('closes on a click outside', async () => {
    const { fixture, cmp, trigger } = setup();
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    document.body.click();
    fixture.detectChanges();
    expect(cmp.open()).toBe(false);
  });
});
