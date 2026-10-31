import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ORGANISATION_SERVICE,
  OrganisationDto,
  OrganisationNames,
  UpdateOrganisationRequest,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  DialogService,
  FormErrorFocusDirective,
  FormFieldComponent,
  StackComponent,
  SwitchComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  TurnChaptersOffData,
  TurnChaptersOffDialog,
} from '../turn-chapters-off/turn-chapters-off.dialog';

const MAX_NAME = 100;
const MAX_SHORT_NAME = 30;
const MAX_LABEL = 30;

/** How the dialog closed: saved, or saved with chapters turned off (the page words its toast from it). */
export type GeneralSettingsOutcome = 'saved' | 'chapters-off';

/**
 * Edit general settings (L2-147 AC4, AC5, L2-140 AC1, AC6), matching docs/mocks/dialogs/edit-general-settings: the
 * name, the short name and whether the organisation has chapters, with the label's two forms. Turning chapters off
 * while any exist asks first (TurnChaptersOffDialog). A failed save keeps the input and offers Try again.
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
    SwitchComponent,
    TextFieldComponent,
  ],
  templateUrl: './edit-general-settings.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditGeneralSettingsDialog {
  protected readonly names = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<GeneralSettingsOutcome>>(DialogRef);
  private readonly organisations = inject(ORGANISATION_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly current = inject<OrganisationDto>(DIALOG_DATA);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly maxName = MAX_NAME;
  protected readonly maxShortName = MAX_SHORT_NAME;
  protected readonly maxLabel = MAX_LABEL;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.current.name],
    shortName: [this.current.shortName],
    chapters: [this.current.chapterLabel !== null],
    singular: [this.current.chapterLabel?.singular ?? ''],
    plural: [this.current.chapterLabel?.plural ?? ''],
  });
  protected readonly chaptersOn = toSignal(this.form.controls.chapters.valueChanges, {
    initialValue: this.form.controls.chapters.value,
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly nameError = signal('');
  protected readonly shortNameError = signal('');
  protected readonly singularError = signal('');
  protected readonly pluralError = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const name = this.form.controls.name.value.trim();
    const shortName = this.form.controls.shortName.value.trim();
    const on = this.form.controls.chapters.value;
    const singular = this.form.controls.singular.value.trim();
    const plural = this.form.controls.plural.value.trim();
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
    this.singularError.set(on ? labelError(singular, 'singular') : '');
    this.pluralError.set(on ? labelError(plural, 'plural') : '');
    if (this.nameError() || this.shortNameError() || this.singularError() || this.pluralError()) {
      this.errorFocus().focusFirstError();
      return;
    }

    const request: UpdateOrganisationRequest = {
      name,
      shortName,
      chapterLabel: on ? { singular, plural } : null,
    };
    if (!on && this.current.chapterLabel && this.current.chapters.length > 0) {
      this.confirmChaptersOff(request);
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      await firstValueFrom(this.organisations.update(request));
      this.ref.close('saved');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        const errors = problemDetails(error)?.errors;
        this.nameError.set(errors?.['Name']?.[0] ?? '');
        this.shortNameError.set(errors?.['ShortName']?.[0] ?? '');
        this.singularError.set(errors?.['ChapterLabel.Singular']?.[0] ?? '');
        this.pluralError.set(errors?.['ChapterLabel.Plural']?.[0] ?? '');
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Turning chapters off while chapters exist asks first; the confirmation saves (L2-140 AC6). */
  private confirmChaptersOff(request: UpdateOrganisationRequest): void {
    const data: TurnChaptersOffData = {
      label: this.current.chapterLabel!,
      chapterCount: this.current.chapters.length,
      submit: () => firstValueFrom(this.organisations.update(request)),
    };
    this.dialogs.open<boolean>(TurnChaptersOffDialog, { data }).closed.subscribe((off) => {
      if (off) this.ref.close('chapters-off');
    });
  }
}

function labelError(label: string, form: 'singular' | 'plural'): string {
  if (!label) return `Enter the ${form} label too.`;
  return label.length > MAX_LABEL
    ? `Use ${MAX_LABEL} characters or fewer for the ${form} label.`
    : '';
}
