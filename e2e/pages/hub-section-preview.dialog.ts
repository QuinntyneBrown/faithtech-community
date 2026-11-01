import { Locator, Page } from '@playwright/test';

/** "{Section} preview" (docs/mocks/dialogs/hub-section-preview): the section as visitors will see it. */
export class HubSectionPreviewDialog {
  readonly dialog: Locator;
  readonly edit: Locator;
  readonly close: Locator;

  constructor(page: Page, title: string) {
    this.dialog = page.getByRole('dialog', { name: `${title} preview` });
    this.edit = this.dialog.getByRole('button', { name: `Edit ${title}`, exact: true });
    this.close = this.dialog.getByRole('button', { name: 'Close', exact: true }).last();
  }

  heading(name: string): Locator {
    return this.dialog.getByRole('heading', { name, exact: true });
  }

  link(name: string | RegExp): Locator {
    return this.dialog.getByRole('link', { name });
  }

  text(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }
}
