import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { ToastVariant } from './toast.component';

export interface ToastOptions {
  variant: ToastVariant;
  heading: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** ms before auto-dismiss; null keeps it until dismissed. Defaults: 6000 for info/success, none otherwise. */
  duration?: number | null;
}

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  heading: string;
  text: string | null;
  actionLabel: string | null;
  duration: number | null;
}

interface Timer {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
}

const DEFAULT_DURATION = 6000;

/** Queue of toasts rendered by `ft-toast-region`. Warning and danger toasts stay until dismissed. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly queue = signal<ToastItem[]>([]);
  readonly toasts = this.queue.asReadonly();

  private nextId = 1;
  private readonly timers = new Map<number, Timer>();
  private readonly actions = new Map<number, () => void>();
  private readonly triggers = new Map<number, HTMLElement>();
  private readonly document = inject(DOCUMENT);

  show(options: ToastOptions): number {
    const id = this.nextId++;
    const duration =
      options.duration !== undefined
        ? options.duration
        : options.variant === 'info' || options.variant === 'success'
          ? DEFAULT_DURATION
          : null;
    this.queue.update((list) => [
      ...list,
      {
        id,
        variant: options.variant,
        heading: options.heading,
        text: options.text ?? null,
        actionLabel: options.actionLabel ?? null,
        duration,
      },
    ]);
    if (options.onAction) this.actions.set(id, options.onAction);
    // Where focus goes back to if this toast is focused when it closes (toast design, Focus).
    const active = this.document.activeElement;
    if (active instanceof HTMLElement && active !== this.document.body) {
      this.triggers.set(id, active);
    }
    if (duration !== null) {
      this.timers.set(id, { handle: null, remaining: duration, startedAt: 0 });
      this.resume(id);
    }
    return id;
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.timers.delete(id);
    this.actions.delete(id);
    this.triggers.delete(id);
    this.queue.update((list) => list.filter((t) => t.id !== id));
  }

  /** The element that had focus when the toast was shown, if any. */
  triggerOf(id: number): HTMLElement | null {
    return this.triggers.get(id) ?? null;
  }

  runAction(id: number): void {
    const action = this.actions.get(id);
    this.dismiss(id);
    action?.();
  }

  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle === null) return;
    this.clearTimer(id);
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
  }

  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle !== null) return;
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    if (timer.handle !== null) clearTimeout(timer.handle);
    timer.handle = null;
  }
}
