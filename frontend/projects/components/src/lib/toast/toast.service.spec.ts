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
