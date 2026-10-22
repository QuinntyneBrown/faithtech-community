import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  PARTNERS_SERVICE,
  PARTNER_STAGES,
  PARTNER_STAGE_LABELS,
  PartnerDto,
  PartnerStage,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  RadioComponent,
  RadioGroupComponent,
  StackComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

export interface MovePartnerData {
  partnerId: string;
  name: string;
  stage: PartnerStage;
}

/**
 * Moves a partner to another stage with an optional note for its history (L2-018 AC2, AC3),
 * matching docs/mocks/dialogs/move-partner. It is the keyboard and screen-reader path for the
 * board's drag. Closes with the moved partner.
 */
@Component({
  selector: 'ft-move-partner-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    RadioComponent,
    RadioGroupComponent,
    StackComponent,
    TextareaComponent,
  ],
  templateUrl: './move-partner.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovePartnerDialog {
  protected readonly ref = inject<DialogRef<PartnerDto>>(DialogRef);
  protected readonly data = inject<MovePartnerData>(DIALOG_DATA);
  private readonly partners = inject(PARTNERS_SERVICE);

  protected readonly stages = PARTNER_STAGES;
  protected readonly labels = PARTNER_STAGE_LABELS;
  protected readonly to = new FormControl<PartnerStage>(nextStage(this.data.stage), {
    nonNullable: true,
  });
  protected readonly note = new FormControl('', { nonNullable: true });
  private readonly chosen = toSignal(this.to.valueChanges, { initialValue: this.to.value });
  protected readonly unchanged = computed(() => this.chosen() === this.data.stage);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected label(stage: PartnerStage): string {
    return this.labels[stage];
  }

  protected async move(): Promise<void> {
    if (this.busy() || this.unchanged()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      this.ref.close(
        await firstValueFrom(
          this.partners.move(this.data.partnerId, this.to.value, this.note.value.trim() || null),
        ),
      );
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}

/** The stage after the current one, or the first stage from Confirmed. */
function nextStage(stage: PartnerStage): PartnerStage {
  const index = PARTNER_STAGES.indexOf(stage);
  return PARTNER_STAGES[index === PARTNER_STAGES.length - 1 ? 0 : index + 1];
}
