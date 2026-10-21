import { Locator, Page } from '@playwright/test';

/** Edit a partner at /partners/:id/edit (docs/mocks/pages/partner-form). */
export class PartnerFormPage {
  readonly heading: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly owner: Locator;
  readonly notes: Locator;
  readonly save: Locator;
  readonly summary: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.name = page.getByRole('textbox', { name: 'Organisation' });
    this.email = page.getByRole('textbox', { name: /^Email/ });
    this.owner = page.getByRole('combobox', { name: /^Owner/ });
    this.notes = page.getByRole('textbox', { name: /^Notes/ });
    this.save = page.getByRole('button', { name: 'Save partner' });
    this.summary = page.locator('ft-error-summary');
  }

  /** Waits for the error summary to take focus and the smooth scroll up to it to finish. */
  async showingErrors(): Promise<void> {
    await this.page.locator('ft-error-summary [role="alert"]').waitFor();
    await this.page.waitForFunction(
      () =>
        new Promise<boolean>((resolve) => {
          const y = window.scrollY;
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              resolve(
                window.scrollY === y &&
                  document.activeElement?.closest('ft-error-summary') !== null,
              ),
            ),
          );
        }),
    );
  }
}
