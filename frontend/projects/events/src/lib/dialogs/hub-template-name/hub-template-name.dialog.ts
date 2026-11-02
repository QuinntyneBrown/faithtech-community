import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HubTemplateSummaryDto, problemDetails } from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  StackComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { Observable, firstValueFrom } from 'rxjs';

/** HubTemplate.NameMaxLength and DescriptionMaxLength. */
export const MAX_TEMPLATE_NAME = 60;
export const MAX_TEMPLATE_DESCRIPTION = 120;

export interface HubTemplateNameData {
  /** The template being renamed; absent when adding. */
  template?: { name: string; description: string };
  save: (name: string, description: string | null) => Observable<HubTemplateSummaryDto>;
}

/**
 * Add a hub template or rename one (L2-185 AC1, AC2, AC3, AC7), matching docs/mocks/dialogs/hub-template-name: a name
 * of up to 60 characters, unique among the active templates, and an optional one-line description. Closes with the
 * saved template; a refused name shows inline, and a failed save keeps what was entered and offers Try again.
 */
@Component({
  selector: 'ft-hub-template-name-dialog',
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
  templateUrl: './hub-template-name.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubTemplateNameDialog {
  protected readonly ref = inject<DialogRef<HubTemplateSummaryDto>>(DialogRef);
  protected readonly data = inject<HubTemplateNameData>(DIALOG_DATA);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly maxName = MAX_TEMPLATE_NAME;
  protected readonly maxDescription = MAX_TEMPLATE_DESCRIPTION;
  protected readonly renaming = !!this.data.template;
  protected readonly heading = this.data.template
    ? `Rename ${this.data.template.name}`
    : 'Add a hub template';
  protected readonly description = this.renaming
    ? 'Leads see the name and description when they create a hub.'
    : 'It starts with the seven core sections shown and no text. Choose its sections and write its text next.';
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.template?.name ?? ''],
    description: [this.data.template?.description ?? ''],
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly nameError = signal('');
  protected readonly descriptionError = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const name = this.form.controls.name.value.trim();
    const description = this.form.controls.description.value.trim();
    this.nameError.set(
      !name
        ? 'Enter a name.'
        : name.length > MAX_TEMPLATE_NAME
          ? `Use ${MAX_TEMPLATE_NAME} characters or fewer.`
          : '',
    );
    this.descriptionError.set(
      description.length > MAX_TEMPLATE_DESCRIPTION
        ? `Use ${MAX_TEMPLATE_DESCRIPTION} characters or fewer.`
        : '',
    );
    if (this.nameError() || this.descriptionError()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      this.ref.close(await firstValueFrom(this.data.save(name, description || null)));
    } catch (error) {
      const errors =
        error instanceof HttpErrorResponse && error.status === 400
          ? problemDetails(error)?.errors
          : undefined;
      if (errors) {
        this.nameError.set(errors['name']?.[0] ?? '');
        this.descriptionError.set(errors['description']?.[0] ?? '');
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
