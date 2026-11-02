import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HubSectionKind, HubTemplateDetailDto, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  DialogComponent,
  StackComponent,
} from '@faithtech-community/components';
import { Observable, firstValueFrom } from 'rxjs';

import { HUB_SECTIONS } from '../../hub-sections/sections';

export interface HubTemplateSectionsData {
  name: string;
  shown: HubSectionKind[];
  save: (shown: HubSectionKind[]) => Observable<HubTemplateDetailDto>;
}

/**
 * Choose sections (L2-186 AC2), matching docs/mocks/dialogs/hub-template-sections: every kind in catalogue order, ticked
 * when new hubs show it. At least one stays ticked. Closes with the saved template; a failed save offers Try again.
 */
@Component({
  selector: 'ft-hub-template-sections-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    DialogComponent,
    StackComponent,
  ],
  templateUrl: './hub-template-sections.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubTemplateSectionsDialog {
  protected readonly ref = inject<DialogRef<HubTemplateDetailDto>>(DialogRef);
  protected readonly data = inject<HubTemplateSectionsData>(DIALOG_DATA);
  protected readonly sections = HUB_SECTIONS;
  protected readonly shown = new FormControl<string[]>([...this.data.shown], {
    nonNullable: true,
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly error = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const shown = HUB_SECTIONS.map((s) => s.kind).filter((k) => this.shown.value.includes(k));
    this.error.set(shown.length === 0 ? 'Tick at least one section.' : '');
    if (this.error()) return;

    this.busy.set(true);
    this.failed.set(false);
    try {
      this.ref.close(await firstValueFrom(this.data.save(shown)));
    } catch (error) {
      const refusal =
        error instanceof HttpErrorResponse && error.status === 400
          ? problemDetails(error)?.errors?.['shown']?.[0]
          : undefined;
      if (refusal) this.error.set(refusal);
      else this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
