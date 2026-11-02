import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { AlertComponent } from '../alert/alert.component';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { QrCodeComponent } from '../qr-code/qr-code.component';

export interface QrPresenterNote {
  heading: string;
  text: string;
}

let nextId = 0;

/**
 * One QR code filling the screen, for a projector (design system: QR presenter). Open it in a CDK dialog with
 * `DialogService.open(…, …, { fullScreen: true })`. It asks the browser for full screen (a refusal is ignored),
 * emits `closed` from Close full screen or when the browser leaves the full screen it entered, and leaves full
 * screen when it is destroyed. Escape is the CDK dialog's own.
 */
@Component({
  selector: 'ft-qr-presenter',
  imports: [AlertComponent, ButtonComponent, IconComponent, QrCodeComponent],
  templateUrl: './qr-presenter.component.html',
  styleUrl: './qr-presenter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrPresenterComponent {
  private readonly document = inject(DOCUMENT);

  readonly value = input.required<string>();
  readonly alt = input.required<string>();
  readonly heading = input.required<string>();
  readonly lead = input<string | null>(null);
  readonly note = input<QrPresenterNote | null>(null);
  readonly closed = output<void>();

  protected readonly titleId = `ft-qr-presenter-title-${nextId++}`;
  private entered = false;

  constructor() {
    const onChange = () => {
      if (this.entered && !this.document.fullscreenElement) {
        this.entered = false;
        this.closed.emit();
      }
    };
    afterNextRender(() => {
      // The CDK container carries role=dialog and aria-modal; label it with the title.
      this.document
        .getElementById(this.titleId)
        ?.closest('.cdk-dialog-container')
        ?.setAttribute('aria-labelledby', this.titleId);
      this.document.addEventListener('fullscreenchange', onChange);
      const root = this.document.documentElement;
      if (typeof root.requestFullscreen !== 'function' || this.document.fullscreenElement) return;
      root.requestFullscreen().then(
        () => (this.entered = true),
        () => undefined,
      );
    });
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('fullscreenchange', onChange);
      if (this.entered && this.document.fullscreenElement) {
        this.entered = false;
        void this.document.exitFullscreen().catch(() => undefined);
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }
}
