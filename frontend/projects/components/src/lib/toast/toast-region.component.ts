import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
}
