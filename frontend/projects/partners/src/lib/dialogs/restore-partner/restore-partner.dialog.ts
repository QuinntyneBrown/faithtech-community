import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  OrganisationNames,
  PARTNER_STAGE_LABELS,
  PartnerDto,
  PARTNERS_SERVICE,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface RestorePartnerData {
  /** The archived partner, with the kept partner's name and version in `archived`. */
  partner: PartnerDto;
}

/**
 * Confirms restoring a merged partner (L2-115 AC4, AC6), matching docs/mocks/dialogs/restore-partner.
 * System Admin only. A refusal shows "Partner not restored" with Reload and try again, which reads
 * the partner (and so both versions) again. Closes with the restored partner.
 */
@Component({
  selector: 'ft-restore-partner-dialog',
  imports: [AlertComponent, ButtonComponent, DialogComponent, StackComponent],
  templateUrl: './restore-partner.dialog.html',
  styleUrl: './restore-partner.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestorePartnerDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<PartnerDto>>(DialogRef);
  protected readonly data = inject<RestorePartnerData>(DIALOG_DATA);
  private readonly partners = inject(PARTNERS_SERVICE);

  protected readonly partner = signal(this.data.partner);
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly labels = PARTNER_STAGE_LABELS;

  protected description(partner: PartnerDto): string {
    return `It comes back as its own partner at its old stage, ${this.labels[partner.stage]}, and the timeline entries that came from it move back from ${partner.archived?.mergedIntoName}.`;
  }

  protected async restore(): Promise<void> {
    const partner = this.partner();
    if (this.busy() || !partner.archived) return;
    this.busy.set(true);
    this.failure.set(null);
    try {
      this.ref.close(
        await firstValueFrom(
          this.partners.restore(partner.id, {
            version: partner.version,
            mergedIntoVersion: partner.archived.mergedIntoVersion,
          }),
        ),
      );
    } catch (error) {
      this.failure.set(
        problemDetails(error)?.detail ??
          `We couldn’t reach ${this.organisation.shortName()}. Nothing was changed.`,
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** Reads the partner again; when someone else already restored it, closes with it. */
  protected async reload(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const partner = await firstValueFrom(this.partners.get(this.partner().id));
      if (!partner.archived) {
        this.ref.close(partner);
        return;
      }
      this.partner.set(partner);
      this.failure.set(null);
    } catch {
      this.failure.set('We couldn’t reload the partner. Check your connection and try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
