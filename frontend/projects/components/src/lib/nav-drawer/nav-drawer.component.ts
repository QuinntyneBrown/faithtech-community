import { A11yModule } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { ButtonComponent } from '../button';
import { IconComponent } from '../icon';

export interface NavDrawerLink {
  label: string;
  href: string;
  /** Name from the design system icon set. */
  icon?: string;
  /** Marks the current page (`aria-current="page"`). */
  current?: boolean;
}

/**
 * Phone navigation drawer on the CDK Overlay: a modal panel sliding in from the start edge with
 * a focus trap, Escape and backdrop dismissal, and focus returned to the opener. `open` is
 * two-way; `closed` fires when the user dismisses it.
 */
@Component({
  selector: 'ft-nav-drawer',
  imports: [A11yModule, ButtonComponent, IconComponent],
  templateUrl: './nav-drawer.component.html',
  styleUrl: './nav-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavDrawerComponent {
  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);
  private overlayRef: OverlayRef | null = null;

  readonly open = model(false);
  readonly links = input<NavDrawerLink[]>([]);
  readonly label = input('Main menu');
  readonly closed = output<void>();

  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');

  constructor() {
    effect(() => (this.open() ? this.attach() : this.detach()));
    inject(DestroyRef).onDestroy(() => this.detach());
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.closed.emit();
  }

  private attach(): void {
    if (this.overlayRef) return;
    const ref = this.overlay.create({
      hasBackdrop: true,
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay.position().global().left('0').top('0'),
      height: '100%',
    });
    ref.attach(new TemplatePortal(this.panel(), this.vcr));
    if (ref.backdropElement) ref.backdropElement.style.background = 'var(--color-bg-backdrop)';
    ref.backdropClick().subscribe(() => this.close());
    ref.keydownEvents().subscribe((e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
    this.overlayRef = ref;
  }

  private detach(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
