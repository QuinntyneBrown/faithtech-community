import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ORGANISATION_SERVICE,
  OrganisationNames,
  PartnerDto,
  PARTNERS_SERVICE,
  PartnerStage,
  PartnerStageOption,
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
import { firstValueFrom, map } from 'rxjs';

export interface MovePartnerData {
  partnerId: string;
  name: string;
  /** The partner's stage key. */
  stage: PartnerStage;
}

/**
 * Moves a partner to another stage with an optional note for its history (L2-018 AC2, AC3),
 * matching docs/mocks/dialogs/move-partner. It is the keyboard and screen-reader path for the
 * board's drag. It offers the organisation's active stages (L2-144 AC3, AC4). Closes with the moved partner.
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
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<PartnerDto>>(DialogRef);
  protected readonly data = inject<MovePartnerData>(DIALOG_DATA);
  private readonly partners = inject(PARTNERS_SERVICE);

  protected readonly stages = toSignal(
    inject(ORGANISATION_SERVICE)
      .get()
      .pipe(map((o) => o.partnerStages)),
    { initialValue: [] as PartnerStageOption[] },
  );
  protected readonly to = new FormControl<PartnerStage>('', { nonNullable: true });
  protected readonly note = new FormControl('', { nonNullable: true });
  private readonly chosen = toSignal(this.to.valueChanges, { initialValue: this.to.value });
  protected readonly unchanged = computed(
    () => !this.chosen() || this.chosen() === this.data.stage,
  );

  constructor() {
    // The stage after the current one is chosen once the stages arrive.
    effect(() => {
      const stages = this.stages();
      if (stages.length && !this.to.value) this.to.setValue(nextStage(stages, this.data.stage));
    });
  }
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected label(stage: PartnerStage): string {
    return this.stages().find((s) => s.key === stage)?.name ?? '';
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

/** The stage after the current one, or the first stage from the last one or from an archived stage. */
function nextStage(stages: readonly PartnerStageOption[], stage: PartnerStage): PartnerStage {
  const index = stages.findIndex((s) => s.key === stage);
  return stages[index < 0 || index === stages.length - 1 ? 0 : index + 1].key;
}
