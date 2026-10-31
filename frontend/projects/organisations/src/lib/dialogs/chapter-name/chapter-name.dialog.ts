import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ChapterDto,
  ChapterLabel,
  ORGANISATION_SERVICE,
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
import { Observable, firstValueFrom } from 'rxjs';

const MAX_NAME = 60;

export interface ChapterNameData {
  label: ChapterLabel;
  /** The chapter to rename; none adds one. */
  chapter?: { id: string; name: string };
}

/**
 * Add a {chapter} and Rename {name} (L2-140 AC3, AC4), matching docs/mocks/dialogs/add-chapter and rename-chapter: one
 * name of up to 60 characters, unique among active chapters. Closes with the saved chapter; a failed save keeps the
 * input and offers Try again.
 */
@Component({
  selector: 'ft-chapter-name-dialog',
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
  templateUrl: './chapter-name.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterNameDialog {
  protected readonly names = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<ChapterDto>>(DialogRef);
  protected readonly data = inject<ChapterNameData>(DIALOG_DATA);
  private readonly organisations = inject(ORGANISATION_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly maxName = MAX_NAME;
  protected readonly renaming = !!this.data.chapter;
  protected readonly singular = this.data.label.singular.toLowerCase();
  protected readonly heading = this.data.chapter
    ? `Rename ${this.data.chapter.name}`
    : `Add a ${this.singular}`;
  protected readonly description = this.data.chapter
    ? 'Members, events and roles tagged with it show the new name.'
    : 'It’s added at the end of the list. Drag it or use its move buttons to change the order.';
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.chapter?.name ?? ''],
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly nameError = signal('');

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const name = this.form.controls.name.value.trim();
    this.nameError.set(
      !name
        ? 'Enter a name.'
        : name.length > MAX_NAME
          ? `Use ${MAX_NAME} characters or fewer for the name.`
          : '',
    );
    if (this.nameError()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    try {
      const request: Observable<ChapterDto> = this.data.chapter
        ? this.organisations.renameChapter(this.data.chapter.id, name)
        : this.organisations.addChapter(name);
      this.ref.close(await firstValueFrom(request));
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
