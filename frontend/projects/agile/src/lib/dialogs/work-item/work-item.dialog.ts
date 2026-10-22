import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AGILE_SERVICE,
  WorkItemDto,
  WorkItemKind,
  WorkspaceDto,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  DialogComponent,
  FormErrorFocusDirective,
  FormFieldComponent,
  RadioComponent,
  RadioGroupComponent,
  SelectComponent,
  SelectOption,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { POINTS, flatten } from '../../work-item-labels';

export interface WorkItemDialogData {
  workspace: WorkspaceDto;
  /** Edit this item; without it the dialog creates one. */
  item?: WorkItemDto;
  /** Preset kind and parent, e.g. a task for a story. */
  kind?: WorkItemKind;
  parentId?: string;
}

const PARENT: Partial<Record<WorkItemKind, { kind: WorkItemKind; label: string; none: string }>> = {
  Epic: { kind: 'Initiative', label: 'Initiative (optional)', none: 'No initiative' },
  Story: { kind: 'Epic', label: 'Epic (optional)', none: 'No epic' },
  Task: { kind: 'Story', label: 'Story (required)', none: 'Choose a story' },
};
const KINDS: { kind: WorkItemKind; hint: string }[] = [
  { kind: 'Initiative', hint: 'A big outcome; holds epics' },
  { kind: 'Epic', hint: 'Sits under an initiative; holds stories' },
  { kind: 'Story', hint: 'Sits under an epic; holds tasks' },
  { kind: 'Task', hint: 'Always belongs to a story' },
];
const TASK_NEEDS_STORY = 'A task must belong to a story.';

/**
 * Creates a work item or edits one (L2-032, L2-033), matching docs/mocks/dialogs/new-work-item (default,
 * member, task, invalid, invalid-title, edit). Members choose Story or Task; the owner also plans
 * initiatives and epics. Closes with the created item, or true after an edit.
 */
@Component({
  selector: 'ft-work-item-dialog',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    RadioComponent,
    RadioGroupComponent,
    SelectComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './work-item.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkItemDialog {
  protected readonly ref = inject<DialogRef<WorkItemDto | true>>(DialogRef);
  protected readonly data = inject<WorkItemDialogData>(DIALOG_DATA);
  private readonly agile = inject(AGILE_SERVICE);
  private readonly errorFocus = viewChild.required(FormErrorFocusDirective);

  protected readonly editing = this.data.item !== undefined;
  protected readonly kinds = KINDS.filter(
    (k) => this.data.workspace.canManage || k.kind === 'Story' || k.kind === 'Task',
  );
  protected readonly form = inject(NonNullableFormBuilder).group({
    kind: [this.data.item?.kind ?? this.data.kind ?? ('Story' as WorkItemKind)],
    title: [this.data.item?.title ?? ''],
    parentId: [this.data.item?.parent?.id ?? this.data.parentId ?? ''],
    assigneeId: [this.data.item?.assigneeId ?? ''],
    storyPoints: [this.data.item?.storyPoints?.toString() ?? ''],
    description: [this.data.item?.description ?? ''],
  });
  protected readonly kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });
  protected readonly heading = this.editing
    ? `Edit ${this.data.item!.kind.toLowerCase()}`
    : 'New work item';
  protected readonly parent = computed(() => PARENT[this.kind()]);

  private readonly candidates = signal<{ id: string; kind: WorkItemKind; title: string }[]>([]);
  protected readonly parentOptions = computed<SelectOption[]>(() => {
    const parent = this.parent();
    if (!parent) return [];
    return [
      { value: '', label: parent.none },
      ...this.candidates()
        .filter((c) => c.kind === parent.kind)
        .map((c) => ({ value: c.id, label: c.title })),
    ];
  });
  protected readonly assigneeOptions: SelectOption[] = [
    { value: '', label: 'Unassigned' },
    ...this.data.workspace.members.map((m) => ({ value: m.profileId, label: m.name })),
  ];
  protected readonly pointOptions: SelectOption[] = [
    { value: '', label: 'Not estimated' },
    ...POINTS.map((p) => ({ value: String(p), label: String(p) })),
  ];

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly titleError = signal('');
  protected readonly parentError = signal('');
  protected readonly assigneeError = signal('');

  constructor() {
    if (!this.editing) void this.loadParents();
    // A parent chosen for one kind is never valid for another.
    this.form.controls.kind.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.parentId.setValue(''));
  }

  protected hint(kind: WorkItemKind): string {
    return KINDS.find((k) => k.kind === kind)!.hint;
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    const value = this.form.getRawValue();
    const kind = value.kind;
    this.titleError.set(value.title.trim() ? '' : 'Give it a title.');
    this.parentError.set(
      !this.editing && kind === 'Task' && !value.parentId ? TASK_NEEDS_STORY : '',
    );
    this.assigneeError.set('');
    if (this.titleError() || this.parentError()) {
      this.errorFocus().focusFirstError();
      return;
    }

    this.busy.set(true);
    this.failed.set(false);
    const storyPoints = kind === 'Story' && value.storyPoints ? Number(value.storyPoints) : null;
    const description = kind === 'Task' ? '' : value.description.trim();
    try {
      if (this.editing) {
        const item = this.data.item!;
        await firstValueFrom(
          this.agile.updateWorkItem(item.id, {
            title: value.title.trim(),
            description,
            assigneeId: value.assigneeId || null,
            storyPoints,
            status: item.kind === 'Task' ? null : item.status,
          }),
        );
        this.ref.close(true);
      } else {
        const created = await firstValueFrom(
          this.agile.createWorkItem(this.data.workspace.id, {
            kind,
            title: value.title.trim(),
            description,
            parentId: this.parent() ? value.parentId || null : null,
            assigneeId: value.assigneeId || null,
            storyPoints,
          }),
        );
        this.ref.close(created);
      }
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        const errors = problemDetails(error)?.errors;
        this.titleError.set(errors?.['Title']?.[0] ?? '');
        this.parentError.set(errors?.['ParentId']?.[0] ?? '');
        this.assigneeError.set(errors?.['AssigneeId']?.[0] ?? '');
        this.errorFocus().focusFirstError();
      } else {
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async loadParents(): Promise<void> {
    try {
      const tree = await firstValueFrom(this.agile.getBacklog(this.data.workspace.id));
      this.candidates.set(flatten(tree).map((n) => ({ id: n.id, kind: n.kind, title: n.title })));
    } catch {
      this.candidates.set([]);
    }
  }
}
