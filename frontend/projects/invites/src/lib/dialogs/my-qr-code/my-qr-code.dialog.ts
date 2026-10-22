import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { CONNECT_SERVICE } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  ClusterComponent,
  CopyFieldComponent,
  DialogComponent,
  IconComponent,
  QrCodeComponent,
  SkeletonComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type Step = 'code' | 'confirm';

/**
 * A City Lead's QR code and connect link (L2-080, L2-081), matching docs/mocks/dialogs/my-qr-code:
 * copy the link, download the image, or make a new code after a confirm step, which retires the old link.
 */
@Component({
  selector: 'ft-my-qr-code-dialog',
  imports: [
    AlertComponent,
    ButtonComponent,
    ClusterComponent,
    CopyFieldComponent,
    DialogComponent,
    IconComponent,
    QrCodeComponent,
    SkeletonComponent,
    StackComponent,
  ],
  templateUrl: './my-qr-code.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyQrCodeDialog {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly connect = inject(CONNECT_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly qrCode = viewChild(QrCodeComponent);

  protected readonly url = signal<string | null>(null);
  protected readonly step = signal<Step>('code');
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly replaced = signal(false);
  protected readonly replaceFailed = signal(false);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadFailed.set(false);
    try {
      this.url.set((await firstValueFrom(this.connect.getMyLink())).url);
    } catch {
      this.loadFailed.set(true);
    }
  }

  protected copied(): void {
    this.toasts.show({
      variant: 'success',
      heading: 'Link copied',
      text: 'Paste it in a message to anyone you want to connect with.',
    });
  }

  protected download(): void {
    void this.qrCode()?.downloadPng('faithtech-qr-code.png');
  }

  /** After the confirm step: a new link replaces the old one, which stops working (L2-081 AC3). */
  protected async replace(): Promise<void> {
    if (this.busy()) return;
    this.step.set('code');
    this.busy.set(true);
    this.replaced.set(false);
    this.replaceFailed.set(false);
    try {
      this.url.set((await firstValueFrom(this.connect.replaceMyLink())).url);
      this.replaced.set(true);
    } catch {
      this.replaceFailed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
