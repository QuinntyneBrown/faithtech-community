import { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
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
  SelectComponent,
  SelectOption,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom, map } from 'rxjs';

import {
  PartnerField,
  clientErrors,
  ownerOptions,
  partnerForm,
  serverErrors,
  toRequest,
} from '../../partner-fields';

/**
 * Adds a partner to the shared pipeline (L2-017 AC1), matching docs/mocks/dialogs/add-partner.
 * New partners start at Lead unless another stage is chosen. Closes with the new partner.
 */
@Component({
  selector: 'ft-add-partner-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    SelectComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './add-partner.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPartnerDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<PartnerDto>>(DialogRef);
  private readonly partners = inject(PARTNERS_SERVICE);

  protected readonly form = partnerForm(inject(FormBuilder));
  // The organisation's active stages, the initial one chosen (L2-144 AC3).
  private readonly stages = toSignal(
    inject(ORGANISATION_SERVICE)
      .get()
      .pipe(map((o) => o.partnerStages)),
    { initialValue: [] as PartnerStageOption[] },
  );
  protected readonly stage = new FormControl<PartnerStage>('', { nonNullable: true });
  protected readonly stageOptions = computed<SelectOption[]>(() =>
    this.stages().map((s) => ({ value: s.key, label: s.name })),
  );

  constructor() {
    effect(() => {
      const initial = this.stages().find((s) => s.isInitial) ?? this.stages()[0];
      if (initial && !this.stage.value) this.stage.setValue(initial.key);
    });
  }
  protected readonly owners = toSignal(this.partners.owners(), { initialValue: [] });
  protected readonly ownerOptions = computed(() => ownerOptions(this.owners()));
  protected readonly errors = signal<Partial<Record<PartnerField, string>>>({});
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected error(field: PartnerField): string {
    return this.errors()[field] ?? '';
  }

  protected async add(): Promise<void> {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    this.errors.set(clientErrors(value));
    if (Object.keys(this.errors()).length) return;

    this.busy.set(true);
    this.failed.set(false);
    try {
      this.ref.close(
        await firstValueFrom(
          this.partners.create({ ...toRequest(value), stage: this.stage.value || undefined }),
        ),
      );
    } catch (error) {
      const fields = serverErrors(error);
      if (fields) this.errors.set(fields);
      else this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
