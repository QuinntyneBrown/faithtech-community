import { Locator, Page } from '@playwright/test';

/**
 * Choose from Resources (docs/mocks/dialogs/hub-resource-picker): the organisation's images, or images and PDFs for
 * slides, with search; opened over the Parking or Slides wizard.
 */
export class HubResourcePickerDialog {
  readonly dialog: Locator;
  readonly search: Locator;
  readonly choose: Locator;
  readonly cancel: Locator;
  readonly options: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Choose from Resources', exact: true });
    this.search = this.dialog.getByRole('searchbox', { name: 'Search resources' });
    this.choose = this.dialog.getByRole('button', { name: 'Choose', exact: true });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel', exact: true });
    this.options = this.dialog.locator('input[type="radio"], input[type="checkbox"]');
  }

  /** A resource to pick, by its title. */
  option(title: string): Locator {
    return this.dialog
      .getByRole('radio', { name: new RegExp(`^${title}`) })
      .or(this.dialog.getByRole('checkbox', { name: new RegExp(`^${title}`) }));
  }

  text(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }
}
