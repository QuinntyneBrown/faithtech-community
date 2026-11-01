import { Locator, Page } from '@playwright/test';

/** The Create event hub wizard (docs/mocks/dialogs/create-event-hub). */
export class CreateEventHubDialog {
  readonly dialog: Locator;
  /** "Step 2 of 4 Starting point". */
  readonly step: Locator;
  readonly question: Locator;
  readonly facts: Locator;
  readonly next: Locator;
  readonly back: Locator;
  readonly saveLater: Locator;
  readonly fillInNow: Locator;
  readonly close: Locator;
  readonly alert: Locator;
  readonly tryAgain: Locator;
  readonly saving: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Create event hub' });
    this.step = this.dialog.locator('.ft-stepper__status');
    this.question = this.dialog.getByRole('heading', { level: 3 });
    this.facts = this.dialog.locator('dl');
    this.next = this.dialog.getByRole('button', { name: 'Next' });
    this.back = this.dialog.getByRole('button', { name: 'Back' });
    this.saveLater = this.dialog.getByRole('button', { name: 'Save and finish later' });
    this.fillInNow = this.dialog.getByRole('button', { name: 'Fill in sections now' });
    this.close = this.dialog.getByRole('button', { name: 'Close' });
    this.alert = this.dialog.getByRole('alert');
    this.tryAgain = this.dialog.getByRole('button', { name: 'Try again' });
    this.saving = this.dialog.getByRole('button', { name: 'Saving…' });
  }

  /** The value shown for a fact on step 1, such as When or Where. */
  fact(term: string): Locator {
    return this.facts.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]');
  }

  startingPoint(name: string): Locator {
    return this.dialog
      .getByRole('radiogroup', { name: 'How do you want to start?' })
      .getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  section(name: string): Locator {
    return this.dialog
      .getByRole('group', { name: 'What should the hub include?' })
      .getByRole('checkbox', { name: new RegExp(`^${name}`) });
  }

  sections(): Locator {
    return this.dialog
      .getByRole('group', { name: 'What should the hub include?' })
      .getByRole('checkbox');
  }
}
