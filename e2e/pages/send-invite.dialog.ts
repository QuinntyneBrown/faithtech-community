import { Locator, Page } from '@playwright/test';

/** The Send invite dialog (docs/mocks/dialogs/send-invite). */
export class SendInviteDialog {
  readonly dialog: Locator;
  readonly email: Locator;
  readonly role: Locator;
  readonly note: Locator;
  readonly send: Locator;
  readonly emailError: Locator;
  readonly refusal: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Invite someone to FaithTech' });
    this.email = this.dialog.getByLabel('Email');
    this.role = this.dialog.getByLabel('Join with role');
    this.note = this.dialog.getByLabel(/Personal note/);
    this.send = this.dialog.getByRole('button', { name: /^(Send invite|Sending invite)/ });
    this.emailError = this.dialog.getByText('Enter an email like name@example.org.');
    this.refusal = this.dialog
      .locator('ft-alert')
      .filter({ hasText: 'You can’t send this invite' });
  }
}
