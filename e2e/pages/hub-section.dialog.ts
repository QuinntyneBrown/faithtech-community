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
  readonly preview: Locator;
  readonly close: Locator;

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
    this.preview = this.dialog.getByRole('link', { name: 'Preview the hub (new tab)' });
    this.close = this.dialog.getByRole('button', { name: 'Close', exact: true });
  }

  /** A field by its label, with or without "(optional)". */
  field(label: string): Locator {
    return this.dialog.getByRole('textbox', { name: new RegExp(`^${label}`) });
  }

  /** A select by its label, with or without "(optional)". */
  select(label: string): Locator {
    return this.dialog.getByRole('combobox', { name: new RegExp(`^${label}`) });
  }

  button(name: string): Locator {
    return this.dialog.getByRole('button', { name, exact: true });
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

  link(name: string | RegExp): Locator {
    return this.dialog.getByRole('link', { name });
  }

  /** A row card of a list, such as "Rule 01", by its heading. */
  row(heading: string): Locator {
    return this.dialog.getByRole('group', { name: heading, exact: true });
  }

  /** A field inside a row card, by its label, with or without "(optional)". */
  rowField(heading: string, label: string): Locator {
    return this.row(heading).getByLabel(new RegExp(`^\\s*${label}(\\s*\\(optional\\))?\\s*$`));
  }

  /** A row card's Move up, Move down or Remove button, by the row's heading. */
  rowAction(heading: string, action: 'up' | 'down' | 'remove'): Locator {
    const name = { up: /^Move .* up$/, down: /^Move .* down$/, remove: /^Remove / }[action];
    return this.row(heading).getByRole('button', { name });
  }

  /** The row cards' headings, in order. */
  rowHeadings(): Locator {
    return this.dialog.locator('[role="group"] h4');
  }

  /** A number field by its label. */
  number(label: string): Locator {
    return this.dialog.getByRole('spinbutton', { name: new RegExp(`^${label}`) });
  }

  checkbox(name: string | RegExp): Locator {
    return this.dialog.getByRole('checkbox', { name });
  }

  radio(name: string | RegExp): Locator {
    return this.dialog.getByRole('radio', { name });
  }

  /** A live line, such as the segments' or weights' running total. */
  status(text: string | RegExp): Locator {
    return this.dialog.getByRole('status').filter({ hasText: text });
  }

  /** The image or file input behind an upload button. */
  upload(name: string): Locator {
    return this.dialog.getByLabel(name, { exact: true });
  }
}
