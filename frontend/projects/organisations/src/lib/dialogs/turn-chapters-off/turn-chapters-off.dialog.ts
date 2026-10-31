import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ChapterLabel, OrganisationNames } from '@faithtech-community/api';
import { AlertComponent, ButtonComponent, DialogComponent } from '@faithtech-community/components';

export interface TurnChaptersOffData {
  /** The label being cleared. */
  label: ChapterLabel;
  /** How many active chapters are kept. */
  chapterCount: number;
  /** Saves the settings with chapters off; rejects when unreachable. */
  submit: () => Promise<void>;
}

/**
 * Turn {chapters} off? (L2-140 AC6), matching docs/mocks/dialogs/turn-chapters-off: every chapter and tag is kept and
 * comes back when chapters are turned on again. Closes with true once chapters are off.
 */
@Component({
  selector: 'ft-turn-chapters-off-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent],
  templateUrl: './turn-chapters-off.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnChaptersOffDialog {
  protected readonly names = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<TurnChaptersOffData>(DIALOG_DATA);

  protected readonly singular = this.data.label.singular.toLowerCase();
  protected readonly plural = this.data.label.plural.toLowerCase();
  protected readonly kept =
    this.data.chapterCount === 1
      ? `1 ${this.singular} and every tag are kept.`
      : `${this.data.chapterCount} ${this.plural} and every tag are kept.`;
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async turnOff(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await this.data.submit();
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
