import { Locator, Page } from '@playwright/test';

/** The private-preview wall the server shows before unlocking (docs/mocks/pages/private-preview). */
export class PrivatePreviewPage {
  readonly heading: Locator;
  readonly lead: Locator;
  readonly passphrase: Locator;
  readonly unlock: Locator;
  readonly checking: Locator;
  readonly refusal: Locator;
  readonly lockedOut: Locator;
  readonly images: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Private preview' });
    this.lead = page.getByText('This site is not open yet. Enter the passphrase to continue.');
    this.passphrase = page.getByLabel('Passphrase');
    this.unlock = page.getByRole('button', { name: 'Unlock' });
    this.checking = page.getByRole('button', { name: 'Checking…' });
    this.refusal = page.getByText('That passphrase didn’t work. Check it and try again.');
    this.lockedOut = page.getByRole('alert').filter({ hasText: 'Too many attempts' });
    this.images = page.locator('img, svg:not([aria-hidden="true"]), picture, video');
  }

  /** Opens any address on either host, as a visitor would. */
  async open(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async unlockWith(passphrase: string): Promise<void> {
    await this.passphrase.fill(passphrase);
    await this.unlock.click();
  }

  /** Unlocks with the keyboard alone: tab to the field, type, press Enter. */
  async unlockWithKeyboard(passphrase: string): Promise<void> {
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.type(passphrase);
    await this.page.keyboard.press('Enter');
  }

  title(): Promise<string> {
    return this.page.title();
  }

  /** Everything the page holds that a person or a crawler could read. */
  async everything(): Promise<string> {
    return this.page.content();
  }
}
