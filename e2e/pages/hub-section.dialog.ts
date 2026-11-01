import { Locator, Page } from '@playwright/test';

/**
 * A hub section's wizard, named by the section's title (docs/mocks/dialogs/hub-hero, hub-giving and the other hub-*
 * dialogs): its question, the facts it reads from elsewhere, its fields and its footer.
 */
export class HubSectionDialog {
  readonly dialog: Locator;
  readonly question: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly next: Locator;
  readonly back: Locator;
  readonly saveAndFinishLater: Locator;
  readonly step: Locator;
  readonly failed: Locator;
  readonly tryAgain: Locator;

  constructor(
    private readonly page: Page,
    title: string,
  ) {
    this.dialog = page.getByRole('dialog', { name: title, exact: true });
    this.question = this.dialog.getByRole('heading', { level: 3 }).first();
    this.save = this.dialog.getByRole('button', { name: /^(Save|Saving…)$/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel', exact: true });
    this.next = this.dialog.getByRole('button', { name: /^(Next|Saving…)$/ });
    this.back = this.dialog.getByRole('button', { name: 'Back', exact: true });
    this.saveAndFinishLater = this.dialog.getByRole('button', { name: 'Save and finish later' });
    this.step = this.dialog.locator('.ft-stepper__status');
    this.failed = this.dialog.getByText('We couldn’t save this section');
    this.tryAgain = this.dialog.getByRole('button', { name: 'Try again' });
  }

  /** A field by its label, with or without "(optional)". */
  field(label: string): Locator {
    return this.dialog.getByRole('textbox', { name: new RegExp(`^${label}`) });
  }

  /** A fact the wizard reads from elsewhere, such as the event's "When", by its term. */
  fact(term: string): Locator {
    return this.dialog
      .locator('dt', { hasText: new RegExp(`^${term}$`) })
      .locator('xpath=following-sibling::dd[1]');
  }

  /** Text shown in the dialog, such as an inline error. */
  text(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }

  link(name: string): Locator {
    return this.dialog.getByRole('link', { name });
  }
}
