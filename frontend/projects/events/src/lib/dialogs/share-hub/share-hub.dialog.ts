import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HUB_DRAFT_NOTE, ShareHubData } from './share-hub-data';
import { HubQrFullScreenDialog } from '../hub-qr-full-screen/hub-qr-full-screen.dialog';
import {
  AlertComponent,
  ButtonComponent,
  ClusterComponent,
  CopyFieldComponent,
  DialogComponent,
  DialogService,
  IconComponent,
  QrCodeComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';

/**
 * Share the hub (L2-193), matching docs/mocks/dialogs/share-hub: a QR code of the hub's link with the link
 * beside it, and a note while the hub is a draft. The code is drawn in the browser (ADR 0045).
 */
@Component({
  selector: 'ft-share-hub-dialog',
  imports: [
    AlertComponent,
    ButtonComponent,
    ClusterComponent,
    CopyFieldComponent,
    DialogComponent,
    IconComponent,
    QrCodeComponent,
    StackComponent,
  ],
  templateUrl: './share-hub.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareHubDialog {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly data = inject<ShareHubData>(DIALOG_DATA);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  protected readonly draftNote = HUB_DRAFT_NOTE;
  protected readonly alt = `QR code for the ${this.data.eventTitle} hub`;

  /** Show full screen (L2-194): the presenter over everything; CDK returns focus here when it closes. */
  protected showFullScreen(): void {
    this.dialogs.open<void, ShareHubData>(
      HubQrFullScreenDialog,
      { data: this.data },
      { fullScreen: true },
    );
  }

  protected copied(): void {
    this.toasts.show({
      variant: 'success',
      heading: 'Link copied',
      text: 'Share it with attendees and helpers.',
    });
  }
}
