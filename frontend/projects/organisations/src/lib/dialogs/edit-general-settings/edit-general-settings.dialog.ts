import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ORGANISATION_SERVICE,
  OrganisationDto,
  OrganisationNames,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

const MAX_NAME = 100;
const MAX_SHORT_NAME = 30;

/**
 * Edit general settings (L2-147 AC4, AC5), matching docs/mocks/dialogs/edit-general-settings: the name and short
 * name. Closes with true once saved; a failed save keeps the input and offers Try again. The chapters switch joins
 * it in slice 18.
 */
@Component({
  selector: 'ft-edit-general-settings-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    StackComponent,
    TextFieldComponent,
  ],
  templateUrl: './edit-general-settings.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditGeneralSettingsDialog {
  protected readonly names = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly organisations = inject(ORGANISATION_SERVICE);
  private readonly current = inject<OrganisationDto>(DIALOG_DATA);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly maxName = MAX_NAME;
  protected readonly maxShortName = MAX_SHORT_NAME;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.current.name],
    shortName: [this.current.shortName],
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly nameError = signal('');
  protected readonly shortNameError = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const name = this.form.controls.name.value.trim();
    const shortName = this.form.controls.shortName.value.trim();
    this.nameError.set(
      !name
        ? 'Enter a name.'
        : name.length > MAX_NAME
          ? `Use ${MAX_NAME} characters or fewer for the name.`
          : '',
    );
    this.shortNameError.set(
      !shortName
        ? 'Enter a short name.'
        : shortName.length > MAX_SHORT_NAME
          ? `Use ${MAX_SHORT_NAME} characters or fewer for the short name.`
          : '',
    );
    if (this.nameError() || this.shortNameError()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.organisations.update({ name, shortName }));
      this.ref.close(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        const errors = problemDetails(error)?.errors;
        this.nameError.set(errors?.['Name']?.[0] ?? '');
        this.shortNameError.set(errors?.['ShortName']?.[0] ?? '');
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
