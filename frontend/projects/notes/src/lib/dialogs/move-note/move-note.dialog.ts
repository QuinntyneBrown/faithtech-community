import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  NotePageDto,
  NotePageRef,
  NOTES_SERVICE,
  OrganisationNames,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormFieldComponent,
  RadioComponent,
  RadioGroupComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { debounceTime, firstValueFrom } from 'rxjs';

import { titleOf } from '../../note-format';

export interface MoveResult {
  page: NotePageDto;
  /** The new parent's title, or null at the top level. */
  parentTitle: string | null;
}

const TOP = '';

/** "Move {title}" (L2-091 AC3-AC6), as in docs/mocks/dialogs/move-note. Closes with the moved page. */
@Component({
  selector: 'ft-move-note-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormFieldComponent,
    RadioComponent,
    RadioGroupComponent,
    TextFieldComponent,
  ],
  templateUrl: './move-note.dialog.html',
  styleUrl: './move-note.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveNoteDialog {
  protected readonly organisation = inject(OrganisationNames);
  protected readonly ref = inject<DialogRef<MoveResult>>(DialogRef);
  protected readonly page = inject<NotePageDto>(DIALOG_DATA);
  private readonly notes = inject(NOTES_SERVICE);

  protected readonly title = titleOf(this.page);
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly parent = new FormControl(this.page.parentId ?? TOP, { nonNullable: true });
  protected readonly options = signal<NotePageRef[]>([]);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((q) => void this.load(q));
    void this.load('');
  }

  protected isCurrent(id: string | null): boolean {
    return (id ?? TOP) === (this.page.parentId ?? TOP);
  }

  protected async move(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    const parentId = this.parent.value || null;
    try {
      const page = await firstValueFrom(this.notes.move(this.page.id, parentId));
      const parentTitle = parentId
        ? (this.options().find((o) => o.id === parentId)?.title ?? null)
        : null;
      this.ref.close({ page, parentTitle });
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(q: string): Promise<void> {
    try {
      this.options.set(await firstValueFrom(this.notes.parentOptions(this.page.id, q)));
    } catch {
      this.failed.set(true);
    }
  }
}
