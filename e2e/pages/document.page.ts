import { Locator, Page } from '@playwright/test';

/** The whole rendered document, for checks that a word appears nowhere on a screen. */
export class DocumentText {
  readonly body: Locator;

  constructor(page: Page) {
    this.body = page.locator('body');
  }
}
