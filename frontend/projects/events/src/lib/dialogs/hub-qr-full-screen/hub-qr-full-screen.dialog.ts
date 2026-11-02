import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { QrPresenterComponent } from '@faithtech-community/components';
import { HUB_DRAFT_NOTE, ShareHubData } from '../share-hub/share-hub-data';

/**
 * The hub's QR code full screen, for a projector (L2-194), matching docs/mocks/dialogs/hub-qr-full-screen.
 * Opened with `{ fullScreen: true }`; Esc, Close full screen or leaving the browser's full screen closes it.
 */
@Component({
  selector: 'ft-hub-qr-full-screen-dialog',
  imports: [QrPresenterComponent],
  templateUrl: './hub-qr-full-screen.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubQrFullScreenDialog {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly data = inject<ShareHubData>(DIALOG_DATA);
  protected readonly draftNote = HUB_DRAFT_NOTE;
}
