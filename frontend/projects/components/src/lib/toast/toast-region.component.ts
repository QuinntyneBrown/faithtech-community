import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
})
export class ToastRegionComponent {
  protected readonly service = inject(ToastService);
  protected readonly visible = computed(() => this.service.toasts().slice(-MAX_VISIBLE));
  protected readonly hidden = computed(() =>
    Math.max(0, this.service.toasts().length - MAX_VISIBLE),
  );
}
