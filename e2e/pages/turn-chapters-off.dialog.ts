import { Locator, Page } from '@playwright/test';

/** Turn {chapters} off? (docs/mocks/dialogs/turn-chapters-off). */
export class TurnChaptersOffDialog {
  readonly dialog: Locator;
  readonly turnOff: Locator;
  readonly keepOn: Locator;

  constructor(page: Page, plural: string) {
    const lower = plural.toLowerCase();
    this.dialog = page.getByRole('dialog', { name: `Turn ${lower} off?` });
    this.turnOff = this.dialog.getByRole('button', {
      name: new RegExp(`^(Turn ${lower} off|Saving…|Try again)$`),
    });
    this.keepOn = this.dialog.getByRole('button', { name: `Keep ${lower} on` });
  }
}
