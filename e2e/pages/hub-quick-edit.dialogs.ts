import { Locator, Page } from '@playwright/test';

/** Post an update (docs/mocks/dialogs/post-hub-update). */
export class PostHubUpdateDialog {
  readonly dialog: Locator;
  readonly text: Locator;
  readonly post: Locator;
  readonly cancel: Locator;
  readonly failed: Locator;
  readonly tryAgain: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Post an update' });
    this.text = this.dialog.getByRole('textbox', { name: 'What should everyone know?' });
    this.post = this.dialog.getByRole('button', { name: /^(Post update|Posting…)$/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.failed = this.dialog.getByText('We couldn’t post the update');
    this.tryAgain = this.dialog.getByRole('button', { name: 'Try again' });
  }

  error(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }
}

/** Move a session (docs/mocks/dialogs/move-hub-session). */
export class MoveHubSessionDialog {
  readonly dialog: Locator;
  readonly session: Locator;
  readonly time: Locator;
  readonly shiftLater: Locator;
  readonly move: Locator;
  readonly failed: Locator;
  readonly tryAgain: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Move a session' });
    this.session = this.dialog.getByRole('combobox', { name: 'Which session?' });
    this.time = this.dialog.getByLabel('New time');
    this.shiftLater = this.dialog.getByRole('checkbox', { name: /^Also move the/ });
    this.move = this.dialog.getByRole('button', { name: /^(Move session|Moving…)$/ });
    this.failed = this.dialog.getByText('We couldn’t move the session');
    this.tryAgain = this.dialog.getByRole('button', { name: 'Try again' });
  }

  error(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }
}

/** Swap a link (docs/mocks/dialogs/swap-hub-link). */
export class SwapHubLinkDialog {
  readonly dialog: Locator;
  readonly submission: Locator;
  readonly feedback: Locator;
  readonly link: Locator;
  readonly swap: Locator;
  readonly failed: Locator;
  readonly tryAgain: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Swap a link' });
    this.submission = this.dialog.getByRole('radio', { name: /^Submission/ });
    this.feedback = this.dialog.getByRole('radio', { name: /^Feedback/ });
    this.link = this.dialog.getByRole('textbox', { name: 'New link' });
    this.swap = this.dialog.getByRole('button', { name: /^(Swap link|Swapping…)$/ });
    this.failed = this.dialog.getByText('We couldn’t swap the link');
    this.tryAgain = this.dialog.getByRole('button', { name: 'Try again' });
  }

  error(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }
}
