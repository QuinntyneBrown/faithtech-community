import { ComponentType } from '@angular/cdk/portal';
import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { Injectable, inject } from '@angular/core';

/** Opens components as modal dialogs on the Angular CDK Dialog: focus trap, Escape, backdrop, focus restore. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  open<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config: Partial<DialogConfig<D, DialogRef<R, C>>> = {},
  ): DialogRef<R, C> {
    const sheet = this.isPhone();
    const position = this.overlay.position().global();
    const ref = this.dialog.open<R, D, C>(component, {
      hasBackdrop: true,
      ariaModal: true,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      closeOnNavigation: true,
      width: sheet ? '100%' : 'min(32rem, calc(100vw - 3rem))',
      maxWidth: '100vw',
      positionStrategy: sheet
        ? position.bottom().centerHorizontally()
        : position.centerHorizontally().centerVertically(),
      ...config,
    });
    const backdrop = ref.overlayRef.backdropElement;
    if (backdrop) backdrop.style.background = 'var(--color-bg-backdrop)';
    return ref;
  }

  closeAll(): void {
    this.dialog.closeAll();
  }

  private isPhone(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(max-width: 39.99rem)').matches;
  }
}
