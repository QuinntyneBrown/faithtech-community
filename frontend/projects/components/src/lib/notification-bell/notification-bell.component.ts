import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';
import { BadgeComponent } from '../badge/badge.component';
import { IconComponent } from '../icon/icon.component';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Top-bar bell with an unread count. A button (not a link) with `aria-expanded` and
 * `aria-haspopup="dialog"` that toggles a non-modal panel on the CDK Overlay; project the
 * ft-notification-panel as content. Escape closes and returns focus to the bell, a click outside
 * closes, and opening moves focus to the panel's first control.
 */
@Component({
  selector: 'ft-notification-bell',
  imports: [BadgeComponent, CdkConnectedOverlay, CdkOverlayOrigin, IconComponent],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent {
  readonly unread = input(0);
  readonly open = model(false);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly overlay = viewChild(CdkConnectedOverlay);

  protected readonly label = computed(() =>
    this.unread() > 0 ? `Notifications, ${this.unread()} unread` : 'Notifications',
  );

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  ];

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected focusFirst(): void {
    const panel = this.overlay()?.overlayRef.overlayElement;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }

  protected onOutsideClick(event: MouseEvent): void {
    if (this.trigger().nativeElement.contains(event.target as Node)) return;
    this.open.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  protected onDetach(): void {
    this.open.set(false);
  }
}
