import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AlertComponent,
  ButtonComponent,
  ClusterComponent,
  CopyFieldComponent,
  DialogComponent,
  QrCodeComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';

export interface ShareHubData {
  eventTitle: string;
  /** The hub page's address on the organisation's host (EventHubDto.link, L2-165). */
  link: string;
  status: 'Draft' | 'Published';
}

/** The draft note (L2-193 AC4), shared with the full-screen view (L2-194 AC5). */
export const HUB_DRAFT_NOTE = {
  heading: 'Your hub is a draft',
  text: 'Until you publish it, the code opens the hub only for people who manage event hubs. Everyone else sees “This hub isn’t available”.',
};

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

  protected readonly draftNote = HUB_DRAFT_NOTE;
  protected readonly alt = `QR code for the ${this.data.eventTitle} hub`;

  protected copied(): void {
    this.toasts.show({
      variant: 'success',
      heading: 'Link copied',
      text: 'Share it with attendees and helpers.',
    });
  }
}
