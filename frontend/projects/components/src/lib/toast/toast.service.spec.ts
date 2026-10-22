import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabBarComponent } from '../tab-bar';
import { ToastRegionComponent } from './toast-region.component';
import { ToastService } from './toast.service';

@Component({ imports: [ToastRegionComponent], template: '<ft-toast-region />' })
class HostComponent {}

@Component({
  imports: [ToastRegionComponent, TabBarComponent],
  template: `@if (tabBar()) {
      <ft-tab-bar />
    }
    <ft-toast-region />`,
})
class TabBarHostComponent {
  readonly tabBar = signal(true);
}

@Component({
  imports: [ToastRegionComponent],
  template: `<main tabindex="-1">
      @if (trigger()) {
        <button type="button" class="trigger">Send</button>
      }
      <button type="button" class="other">Other</button>
    </main>
    <ft-toast-region />`,
})
class FocusHostComponent {
  readonly trigger = signal(true);
}

async function focusSetup() {
  const fixture = TestBed.createComponent(FocusHostComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const service = TestBed.inject(ToastService);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const q = <T extends HTMLElement>(s: string) => host.querySelector<T>(s)!;
  return { fixture, host, service, settle, q };
}

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('adds toasts and dismisses them', () => {
    const service = TestBed.inject(ToastService);
    const id = service.show({ variant: 'info', heading: 'Contact restored' });
    expect(service.toasts().map((t) => t.heading)).toEqual(['Contact restored']);
    service.dismiss(id);
    expect(service.toasts()).toEqual([]);
  });

  it('auto-dismisses info and success after 6 seconds', () => {
    const service = TestBed.inject(ToastService);
    service.show({ variant: 'success', heading: 'Saved' });
    vi.advanceTimersByTime(5999);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('keeps warning and danger toasts until dismissed', () => {
    const service = TestBed.inject(ToastService);
    service.show({ variant: 'danger', heading: 'Not saved' });
    service.show({ variant: 'warning', heading: 'Email paused' });
    vi.advanceTimersByTime(60000);
    expect(service.toasts().length).toBe(2);
  });

  it('pauses the timer while hovered or focused and resumes with the remainder', () => {
    const service = TestBed.inject(ToastService);
    const id = service.show({ variant: 'info', heading: 'Hi' });
    vi.advanceTimersByTime(4000);
    service.pause(id);
    vi.advanceTimersByTime(60000);
    expect(service.toasts().length).toBe(1);
    service.resume(id);
    vi.advanceTimersByTime(1999);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('runs the action callback and dismisses the toast', () => {
    const service = TestBed.inject(ToastService);
    const spy = vi.fn();
    const id = service.show({
      variant: 'info',
      heading: 'Gone',
      actionLabel: 'Undo',
      onAction: spy,
    });
    service.runAction(id);
    expect(spy).toHaveBeenCalledOnce();
    expect(service.toasts()).toEqual([]);
  });
});

describe('ToastRegionComponent', () => {
  it('is a persistent polite live region that renders queued toasts', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const region = host.querySelector('[aria-live]') as HTMLElement;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    TestBed.inject(ToastService).show({ variant: 'warning', heading: 'No connection' });
    fixture.detectChanges();
    expect(host.querySelectorAll('ft-toast').length).toBe(1);
  });

  it('sits above the phone tab bar only while one is rendered', () => {
    const fixture = TestBed.createComponent(TabBarHostComponent);
    fixture.detectChanges();
    const region = (fixture.nativeElement as HTMLElement).querySelector('ft-toast-region')!;
    expect(region.classList).toContain('ft-toast-region--above-tab-bar');
    fixture.componentInstance.tabBar.set(false);
    fixture.detectChanges();
    expect(region.classList).not.toContain('ft-toast-region--above-tab-bar');
  });

  describe('focus', () => {
    afterEach(() => document.body.replaceChildren());

    it('returns focus to the trigger when the focused toast is dismissed', async () => {
      const { service, settle, q } = await focusSetup();
      q('.trigger').focus();
      service.show({ variant: 'danger', heading: 'Not sent' });
      await settle();
      expect(document.activeElement).toBe(q('.trigger'));

      q('.toast__close').focus();
      q('.toast__close').click();
      await settle();

      expect(document.activeElement).toBe(q('.trigger'));
    });

    it('returns focus to the trigger when the focused toast runs its action', async () => {
      const { service, settle, q } = await focusSetup();
      q('.trigger').focus();
      const retry = vi.fn();
      service.show({
        variant: 'danger',
        heading: 'Not sent',
        actionLabel: 'Retry',
        onAction: retry,
      });
      await settle();

      q('.toast__action').focus();
      q('.toast__action').click();
      await settle();

      expect(retry).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(q('.trigger'));
    });

    it('moves focus to main when the trigger is gone', async () => {
      const { fixture, service, settle, q, host } = await focusSetup();
      q('.trigger').focus();
      service.show({ variant: 'danger', heading: 'Not sent' });
      await settle();
      fixture.componentInstance.trigger.set(false);
      await settle();

      q('.toast__close').focus();
      q('.toast').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();

      expect(host.querySelector('ft-toast')).toBeNull();
      expect(document.activeElement).toBe(host.querySelector('main'));
    });

    it('leaves focus where it is when a toast it is not in closes', async () => {
      const { service, settle, q } = await focusSetup();
      q('.trigger').focus();
      const id = service.show({ variant: 'danger', heading: 'Not sent' });
      await settle();
      q('.other').focus();

      service.dismiss(id);
      await settle();

      expect(document.activeElement).toBe(q('.other'));
    });
  });

  it('collapses more than three toasts into a "+N more" line', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const service = TestBed.inject(ToastService);
    for (let i = 0; i < 4; i++) service.show({ variant: 'danger', heading: `T${i}` });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelectorAll('ft-toast').length).toBe(3);
    expect(host.textContent).toContain('+1 more');
  });
});
