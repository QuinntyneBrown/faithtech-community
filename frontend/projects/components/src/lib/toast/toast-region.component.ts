import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { TabBarPresence } from '../tab-bar/tab-bar-presence.service';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

const MAX_VISIBLE = 3;

/** Persistent live region for toasts. Render once in the app shell, empty at load. */
@Component({
  selector: 'ft-toast-region',
  imports: [ToastComponent],
  templateUrl: './toast-region.component.html',
  styleUrl: './toast-region.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.ft-toast-region--above-tab-bar]': 'aboveTabBar()' },
})
export class ToastRegionComponent {
  protected readonly service = inject(ToastService);
  /** On phones toasts clear the bottom tab bar and its safe area (toast design, Responsive). */
  protected readonly aboveTabBar = inject(TabBarPresence).present;
  protected readonly visible = computed(() => this.service.toasts().slice(-MAX_VISIBLE));
  protected readonly hidden = computed(() =>
    Math.max(0, this.service.toasts().length - MAX_VISIBLE),
  );

  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  /** The toast holding keyboard focus, with the element focus returns to when it closes. */
  private focused: { id: number; trigger: HTMLElement | null } | null = null;

  constructor() {
    // When the focused toast leaves (Dismiss, Escape, its action or code), focus would fall to
    // body; send it back to the trigger, or to main if the trigger is gone (toast design, Focus).
    effect(() => {
      const ids = this.visible().map((t) => t.id);
      const focused = this.focused;
      if (!focused || ids.includes(focused.id)) return;
      this.focused = null;
      afterNextRender(() => this.restoreFocus(focused.trigger), { injector: this.injector });
    });
  }

  protected onFocusIn(event: FocusEvent): void {
    const toast = (event.target as Element).closest<HTMLElement>('[data-toast-id]');
    if (!toast) return;
    const id = Number(toast.dataset['toastId']);
    if (this.focused?.id !== id) this.focused = { id, trigger: this.service.triggerOf(id) };
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && !this.host.contains(next)) this.focused = null;
  }

  private restoreFocus(trigger: HTMLElement | null): void {
    const active = this.document.activeElement;
    // Something (the action, a dialog) already placed focus: leave it there.
    if (active && active !== this.document.body && active.isConnected) return;
    if (trigger?.isConnected && !trigger.matches(':disabled')) {
      trigger.focus();
      if (this.document.activeElement === trigger) return;
    }
    const main = this.document.querySelector<HTMLElement>('main');
    if (!main) return;
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.focus();
  }
}
