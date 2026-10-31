import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  OrganisationNames,
  problemDetails,
  ResourceDto,
  RESOURCES_SERVICE,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  ErrorSummaryComponent,
  FileDropzoneComponent,
  FileRowComponent,
  FormError,
  FormFieldComponent,
  ListComponent,
  TextFieldComponent,
  formatFileSize,
} from '@faithtech-community/components';
import { firstValueFrom, lastValueFrom } from 'rxjs';

import { extensionOf, fileOrHost, isAllowed, refusal, typeIcon } from '../../resource-format';
import {
  ResourceDetailsComponent,
  detailErrors,
  detailsForm,
  fieldsOf,
  serverErrors,
} from '../resource-details';

export interface EditResourceData {
  resource: ResourceDto;
  /** "Change who can see it" opens the dialog on the visibility picker (L2-061 AC5). */
  focusVisibility?: boolean;
}

/**
 * Edit a resource's details, link, visibility and file (L2-062), as in docs/mocks/dialogs/edit-resource.
 * Replacing the file swaps it in place; closes with the saved resource.
 */
@Component({
  selector: 'ft-edit-resource-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    ErrorSummaryComponent,
    FileDropzoneComponent,
    FileRowComponent,
    FormFieldComponent,
    ListComponent,
    ResourceDetailsComponent,
    TextFieldComponent,
  ],
  templateUrl: './edit-resource.dialog.html',
  styleUrl: './edit-resource.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditResourceDialog implements AfterViewInit {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<ResourceDto>>(DialogRef);
  protected readonly data = inject<EditResourceData>(DIALOG_DATA);
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly details = viewChild(ResourceDetailsComponent);
  private readonly urlField = viewChild<FormFieldComponent>('urlField');

  protected readonly resource = this.data.resource;
  protected readonly form = detailsForm(this.resource);
  protected readonly url = new FormControl(this.resource.linkUrl ?? '', { nonNullable: true });
  protected readonly replacement = signal<File | null>(null);
  protected readonly choosing = signal(false);
  protected readonly errors = signal<Partial<Record<string, string>>>({});
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected readonly typeIcon = typeIcon;
  protected readonly currentMeta = fileOrHost(this.resource);
  protected readonly replacementError = computed(() => {
    const file = this.replacement();
    return file && !isAllowed(file) ? refusal(file.name) : null;
  });
  protected readonly summary = computed<FormError[]>(() => {
    if (!this.submitted()) return [];
    const fields = Object.entries(this.errors())
      .filter(([key]) => key !== 'files')
      .map(([key, message]) => ({ message: message ?? '', fieldId: this.fieldId(key) }));
    const file = this.replacementError()
      ? [{ message: 'Choose another file', fieldId: 'edit-resource-file-error' }]
      : [];
    return [...file, ...fields];
  });
  protected readonly submitText = computed(() =>
    this.busy()
      ? 'Saving…'
      : this.failed()
        ? 'Try again'
        : this.replacement()
          ? 'Save and replace file'
          : 'Save changes',
  );

  ngAfterViewInit(): void {
    if (this.data.focusVisibility) setTimeout(() => this.details()?.focusVisibility());
  }

  protected replacementMeta(file: File): string {
    return `${extensionOf(file.name).toUpperCase()} · ${formatFileSize(file.size)} · new`;
  }

  protected choose(files: File[]): void {
    this.replacement.set(files[0] ?? null);
    this.choosing.set(false);
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.submitted.set(true);
    const errors = detailErrors(this.form, true);
    const url = this.url.value.trim();
    if (this.resource.linkUrl && !/^https:\/\/[^\s/]+\.[^\s]+/i.test(url))
      errors['url'] = 'Use a link that starts with https://.';
    this.errors.set(errors);
    if (Object.keys(errors).length || this.replacementError()) return;

    this.busy.set(true);
    this.failed.set(false);
    try {
      let saved = await firstValueFrom(
        this.resources.update(this.resource.id, {
          ...fieldsOf(this.form, true),
          url: this.resource.linkUrl ? url : null,
        }),
      );
      const file = this.replacement();
      if (file) {
        const done = await lastValueFrom(this.resources.replaceFile(this.resource.id, file));
        if (done.kind === 'done') saved = done.resource;
      }
      this.ref.close(saved);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.errors.set(serverErrors(problemDetails(error)?.errors));
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private fieldId(key: string): string {
    if (key === 'url') return this.urlField()?.controlId() ?? '';
    if (key === 'title' || key === 'type') return this.details()?.fieldId(key) ?? '';
    return '';
  }
}
