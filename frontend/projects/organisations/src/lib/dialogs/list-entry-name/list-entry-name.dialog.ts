import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { OrganisationNames, problemDetails } from '@faithtech-community/api';
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

/** TaxonomyRules.MaxName. */
export const MAX_ENTRY_NAME = 40;

export interface ListEntryNameData<T> {
  heading: string;
  description: string;
  /** The primary action's label while adding, such as "Add stage"; a rename says "Rename". */
  addLabel?: string;
  /** The current name when renaming. */
  name?: string;
  /** Saves the trimmed name; a 400 keyed Name shows inline. */
  save: (name: string) => Observable<T>;
}

/**
 * Add an entry to one of the organisation's lists, or rename one (L2-144 AC1, AC2), matching
 * docs/mocks/dialogs/add-list-entry and rename-list-entry: one name of up to 40 characters, unique among the list's
 * active entries. Closes with the saved entry; a failed save keeps the input and offers Try again.
 */
@Component({
  selector: 'ft-list-entry-name-dialog',
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
  templateUrl: './list-entry-name.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListEntryNameDialog<T> {
  protected readonly names = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<T>>(DialogRef);
  protected readonly data = inject<ListEntryNameData<T>>(DIALOG_DATA);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly maxName = MAX_ENTRY_NAME;
  protected readonly renaming = this.data.name !== undefined;
  protected readonly form = inject(NonNullableFormBuilder).group({ name: [this.data.name ?? ''] });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly nameError = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const name = this.form.controls.name.value.trim();
    this.nameError.set(
      !name
        ? 'Enter a name.'
        : name.length > MAX_ENTRY_NAME
          ? `Use ${MAX_ENTRY_NAME} characters or fewer.`
          : '',
    );
    if (this.nameError()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      this.ref.close(await firstValueFrom(this.data.save(name)));
    } catch (error) {
      const problem = error instanceof HttpErrorResponse ? problemDetails(error) : null;
      const refusal =
        error instanceof HttpErrorResponse && (error.status === 400 || error.status === 409)
          ? (problem?.errors?.['Name']?.[0] ?? problem?.detail)
          : undefined;
      if (refusal) {
        this.nameError.set(refusal);
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
