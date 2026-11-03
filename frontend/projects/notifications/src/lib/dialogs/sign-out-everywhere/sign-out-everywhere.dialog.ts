import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ACCOUNT_SERVICE, OrganisationNames } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  IconComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** Focuses Cancel first, as docs/mocks/dialogs/sign-out-everywhere does, so Enter never ends every session. */
export const SIGN_OUT_EVERYWHERE_FOCUS = '[data-autofocus] button';

/**
 * Confirms ending every session of the account on every device, including this one (L2-052 AC3), matching
 * docs/mocks/dialogs/sign-out-everywhere. Closes with true once every session is revoked; Cancel changes nothing.
 */
@Component({
  selector: 'ft-sign-out-everywhere-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent, IconComponent],
  templateUrl: './sign-out-everywhere.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignOutEverywhereDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly account = inject(ACCOUNT_SERVICE);

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.account.signOutEverywhere());
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
