import { Locator, Page } from '@playwright/test';

/** The My QR code dialog (docs/mocks/dialogs/my-qr-code). */
export class MyQrCodeDialog {
  readonly dialog: Locator;
  readonly qrCode: Locator;
  readonly link: Locator;
  readonly copy: Locator;
  readonly copied: Locator;
  readonly download: Locator;
  readonly makeNewCode: Locator;
  readonly confirmNewCode: Locator;
  readonly keepThisCode: Locator;
  readonly newCodeReady: Locator;
  readonly newCodeFailed: Locator;
  readonly explanation: Locator;
  readonly done: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: /My QR code|Make a new QR code\?/ });
    this.qrCode = this.dialog.getByRole('img', { name: 'QR code for your connect link' });
    this.link = this.dialog.getByRole('textbox', { name: 'Your connect link' });
    this.copy = this.dialog.getByRole('button', { name: 'Copy link' });
    this.copied = this.dialog.getByRole('button', { name: 'Copied' });
    this.download = this.dialog.getByRole('button', { name: 'Download image' });
    this.makeNewCode = this.dialog.getByRole('button', { name: 'Make a new code' });
    this.confirmNewCode = this.dialog.getByRole('button', { name: 'Make a new code' });
    this.keepThisCode = this.dialog.getByRole('button', { name: 'Keep this code' });
    this.newCodeReady = this.dialog.locator('ft-alert').filter({ hasText: 'New code ready' });
    this.newCodeFailed = this.dialog.locator('ft-alert').filter({ hasText: 'New code not made' });
    this.explanation = this.dialog.getByText(/added to your private contacts/);
    this.done = this.dialog.getByRole('button', { name: 'Done' });
  }

  /** The "Link copied" toast outside the dialog. */
  get toast(): Locator {
    return this.page.locator('ft-toast').filter({ hasText: 'Link copied' });
  }

  /** The token at the end of the link the dialog shows. */
  async token(): Promise<string> {
    const url = await this.link.inputValue();
    return url.slice(url.lastIndexOf('/') + 1);
  }
}
