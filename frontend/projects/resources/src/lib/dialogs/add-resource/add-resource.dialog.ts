import { DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
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
  ORGANISATION_SERVICE,
  ResourceTypeOption,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  ErrorSummaryComponent,
  FileDropzoneComponent,
  FileRowComponent,
  FileRowStatus,
  FormError,
  FormFieldComponent,
  ListComponent,
  TabComponent,
  TabsComponent,
  TextFieldComponent,
  formatFileSize,
} from '@faithtech-community/components';
import { firstValueFrom, lastValueFrom, tap } from 'rxjs';

import {
  LIMITS,
  MAX_FILES,
  extensionOf,
  guessType,
  resolveGuess,
  isAllowed,
  refusal,
  titleFrom,
  typeIcon,
} from '../../resource-format';
import {
  ResourceDetailsComponent,
  detailErrors,
  detailsForm,
  fieldsOf,
  serverErrors,
} from '../resource-details';

/** What the add dialog closes with: the resources added and how many files didn't upload. */
export interface AddResourceResult {
  added: ResourceDto[];
  failed: number;
}

interface Row {
  key: number;
  file: File;
  status: FileRowStatus;
  progress: number;
  error: string | null;
}

let nextKey = 0;

/**
 * Add one or more uploaded files, or one https link (L2-057, L2-058, L2-059), as in
 * docs/mocks/dialogs/add-resource. Files upload one at a time so each row shows its progress;
 * each is saved as soon as it finishes.
 */
@Component({
  selector: 'ft-add-resource-dialog',
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
    TabComponent,
    TabsComponent,
    TextFieldComponent,
  ],
  templateUrl: './add-resource.dialog.html',
  styleUrl: './add-resource.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddResourceDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<AddResourceResult>>(DialogRef);
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly organisations = inject(ORGANISATION_SERVICE);
  /** The organisation's active resource types, which the guess maps onto. */
  private readonly types = signal<ResourceTypeOption[]>([]);
  private readonly details = viewChild(ResourceDetailsComponent);
  private readonly urlField = viewChild<FormFieldComponent>('urlField');

  protected readonly limits = LIMITS;
  protected readonly form = detailsForm();
  protected readonly url = new FormControl('', { nonNullable: true });

  /** 0 uploads files, 1 adds a link. */
  protected readonly mode = signal(0);
  protected readonly rows = signal<Row[]>([]);
  protected readonly tooMany = signal(false);
  protected readonly errors = signal<Partial<Record<string, string>>>({});
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  /** Why the server refused the caller, such as an unverified email (L2-057 AC3). */
  protected readonly refusedReason = signal<string | null>(null);
  protected readonly uploading = signal(0);
  protected readonly added = signal<ResourceDto[]>([]);
  private cancelled = false;

  protected readonly single = computed(() => this.rows().length === 1);
  protected readonly refused = computed(() => this.rows().filter((r) => r.status === 'refused'));
  protected readonly didntUpload = computed(() => this.rows().filter((r) => r.status === 'failed'));
  protected readonly typeHint = computed(() =>
    this.single()
      ? `Guessed from .${extensionOf(this.rows()[0].file.name)} — change it if it’s wrong.`
      : '',
  );
  protected readonly summary = computed<FormError[]>(() => {
    if (!this.submitted()) return [];
    const refused = this.refused().map((r) => ({
      message: `Remove ${r.file.name}`,
      fieldId: this.rowErrorId(r),
    }));
    const fields = Object.entries(this.errors())
      .filter(([key]) => key !== 'files')
      .map(([key, message]) => ({ message: message ?? '', fieldId: this.fieldId(key) }));
    return [...refused, ...fields];
  });
  protected readonly submitText = computed(() => {
    const n = this.rows().length;
    if (this.mode() === 1)
      return this.busy() ? 'Adding link…' : this.shared() ? 'Add and share' : 'Add link';
    if (this.busy()) return n > 1 ? `Adding ${n} resources…` : 'Adding resource…';
    if (this.shared()) return 'Add and share';
    return n > 1 ? `Add ${n} resources` : 'Add resource';
  });
  private readonly visibility = signal(this.form.controls.visibility.value);
  protected readonly shared = computed(() => this.visibility() === 'Shared');
  protected readonly canSubmit = computed(
    () => this.mode() === 1 || (this.rows().length > 0 && this.refused().length === 0),
  );

  protected readonly typeIcon = typeIcon;

  constructor() {
    this.form.controls.visibility.valueChanges.subscribe((v) => this.visibility.set(v));
    void this.loadTypes();
  }

  /** The organisation's active resource types, which the guess maps onto (L2-146 AC3). */
  private async loadTypes(): Promise<void> {
    try {
      this.types.set((await firstValueFrom(this.organisations.get())).resourceTypes);
    } catch {
      this.types.set([]);
    }
  }

  protected rowMeta(row: Row): string {
    const size = formatFileSize(row.file.size);
    if (this.rows().length <= 1) return `${extensionOf(row.file.name).toUpperCase()} · ${size}`;
    const key = resolveGuess(row.file.name, this.types());
    return `${this.types().find((t) => t.key === key)?.name ?? key} · ${size}`;
  }

  protected rowIcon(row: Row): string {
    return typeIcon({ type: guessType(row.file.name), extension: extensionOf(row.file.name) });
  }

  protected rowErrorId(row: Row): string {
    return `add-resource-file-${row.key}-error`;
  }

  protected choose(files: File[]): void {
    const room = MAX_FILES - this.rows().length;
    this.tooMany.set(files.length > room);
    const rows = files.slice(0, Math.max(room, 0)).map((file): Row => ({
      key: nextKey++,
      file,
      status: isAllowed(file) ? 'ready' : 'refused',
      progress: 0,
      error: isAllowed(file) ? null : refusal(file.name),
    }));
    const wasEmpty = this.rows().length === 0;
    this.rows.update((list) => [...list, ...rows]);
    if (wasEmpty && this.single()) {
      const file = this.rows()[0].file;
      if (!this.form.controls.title.value) this.form.controls.title.setValue(titleFrom(file.name));
      this.form.controls.type.setValue(resolveGuess(file.name, this.types()));
    }
  }

  protected remove(row: Row): void {
    this.rows.update((list) => list.filter((r) => r !== row));
    this.tooMany.set(false);
  }

  protected switchMode(index: number): void {
    this.mode.set(index);
    this.errors.set({});
    this.submitted.set(false);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.submitted.set(true);
    this.failed.set(false);
    this.refusedReason.set(null);
    if (this.mode() === 1) return this.addLink();
    const errors = detailErrors(this.form, this.single());
    this.errors.set(errors);
    if (Object.keys(errors).length || !this.canSubmit()) return;
    await this.upload(this.rows().filter((r) => r.status === 'ready' || r.status === 'failed'));
  }

  protected retryFailed(): void {
    void this.upload(this.didntUpload());
  }

  protected cancelRemaining(): void {
    this.cancelled = true;
  }

  protected close(): void {
    this.ref.close({ added: this.added(), failed: this.didntUpload().length });
  }

  private async upload(rows: Row[]): Promise<void> {
    this.busy.set(true);
    this.cancelled = false;
    const fields = fieldsOf(this.form, this.single());
    let k = 0;
    for (const row of rows) {
      if (this.cancelled) break;
      this.uploading.set(++k);
      this.update(row, { status: 'uploading', progress: 0, error: null });
      try {
        const done = await lastValueFrom(
          this.resources.upload(row.file, fields).pipe(
            tap((event) => {
              if (event.kind === 'progress') this.update(row, { progress: event.percent });
            }),
          ),
        );
        if (done.kind === 'done') this.added.update((list) => [...list, done.resource]);
        this.update(row, { status: 'uploaded', progress: 100 });
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status === 400) {
          const errors = serverErrors(problemDetails(error)?.errors);
          if (errors['files']) this.update(row, { status: 'refused', error: errors['files'] });
          else this.update(row, { status: 'ready' });
          this.errors.set(errors);
          break;
        }
        if (error instanceof HttpErrorResponse && error.status === 403) {
          this.update(row, { status: 'ready' });
          this.refusedReason.set(problemDetails(error)?.detail ?? 'You can’t add resources.');
          break;
        }
        this.update(row, { status: 'failed' });
      }
    }
    this.busy.set(false);
    if (this.cancelled) {
      this.rows.update((list) => list.filter((r) => r.status !== 'ready'));
    }
    const pending = this.rows().some((r) => r.status !== 'uploaded');
    if (!pending && this.added().length) this.close();
    else if (this.didntUpload().length) this.failed.set(true);
  }

  private async addLink(): Promise<void> {
    const errors = detailErrors(this.form, true);
    const url = this.url.value.trim();
    if (!/^https:\/\/[^\s/]+\.[^\s]+/i.test(url))
      errors['url'] = 'Use a link that starts with https://.';
    this.errors.set(errors);
    if (Object.keys(errors).length) return;
    this.busy.set(true);
    try {
      const added = await firstValueFrom(
        this.resources.addLink({ ...fieldsOf(this.form, true), url }),
      );
      this.ref.close({ added: [added], failed: 0 });
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.errors.set(serverErrors(problemDetails(error)?.errors));
      } else if (error instanceof HttpErrorResponse && error.status === 403) {
        this.refusedReason.set(problemDetails(error)?.detail ?? 'You can’t add resources.');
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private update(row: Row, change: Partial<Row>): void {
    this.rows.update((list) => list.map((r) => (r.key === row.key ? { ...r, ...change } : r)));
  }

  private fieldId(key: string): string {
    if (key === 'url') return this.urlField()?.controlId() ?? '';
    if (key === 'title' || key === 'type') return this.details()?.fieldId(key) ?? '';
    return '';
  }
}
