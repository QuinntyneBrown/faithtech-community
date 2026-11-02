import { Locator, Page } from '@playwright/test';

/** The Share the hub dialog (docs/mocks/dialogs/share-hub). */
export class ShareHubDialog {
  readonly dialog: Locator;
  readonly qrCode: Locator;
  readonly caption: Locator;
  readonly link: Locator;
  readonly linkHelp: Locator;
  readonly copy: Locator;
  readonly draftNote: Locator;
  readonly showFullScreen: Locator;
  readonly download: Locator;
  readonly done: Locator;

  constructor(
    private readonly page: Page,
    eventTitle: string,
  ) {
    this.dialog = page.getByRole('dialog', { name: 'Share the hub' });
    this.qrCode = this.dialog.getByRole('img', { name: `QR code for the ${eventTitle} hub` });
    this.caption = this.dialog.getByText('Scan with a phone camera', { exact: true });
    this.link = this.dialog.getByRole('textbox', { name: 'Hub link' });
    this.linkHelp = this.dialog.getByText('The QR code opens this link.');
    this.copy = this.dialog.getByRole('button', { name: 'Copy link' });
    this.draftNote = this.dialog.locator('ft-alert').filter({ hasText: 'Your hub is a draft' });
    this.showFullScreen = this.dialog.getByRole('button', { name: 'Show full screen' });
    this.download = this.dialog.getByRole('button', { name: 'Download image' });
    this.done = this.dialog.getByRole('button', { name: 'Done' });
  }

  /** The drawn code's modules, to compare one drawing of the code with another. */
  modules(): Promise<string | null> {
    return this.qrCode.locator('path').getAttribute('d');
  }

  /** The "Link copied" toast outside the dialog. */
  get toast(): Locator {
    return this.page.locator('ft-toast').filter({ hasText: 'Link copied' });
  }
}

/** The hub's QR code, full screen (docs/mocks/dialogs/hub-qr-full-screen). */
export class HubQrFullScreen {
  readonly view: Locator;
  readonly qrCode: Locator;
  readonly lead: Locator;
  readonly link: Locator;
  readonly hint: Locator;
  readonly draftNote: Locator;
  readonly close: Locator;

  constructor(page: Page, eventTitle: string, link = '') {
    this.view = page.getByRole('dialog', { name: eventTitle, exact: true });
    this.qrCode = this.view.getByRole('img', { name: `QR code for the ${eventTitle} hub` });
    this.lead = this.view.getByText('Scan with a phone camera to open the hub');
    this.link = this.view.getByText(link, { exact: true });
    this.hint = this.view.getByText('Press Esc to close');
    this.draftNote = this.view.locator('ft-alert').filter({ hasText: 'Your hub is a draft' });
    this.close = this.view.getByRole('button', { name: 'Close full screen' });
  }

  modules(): Promise<string | null> {
    return this.qrCode.locator('path').getAttribute('d');
  }
}
