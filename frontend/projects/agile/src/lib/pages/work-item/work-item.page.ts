import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AGILE_SERVICE,
  SprintDto,
  WorkItemDto,
  WorkItemStatus,
  WorkspaceDto,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BadgeComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  CheckboxGroupComponent,
  ClusterComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogService,
  EmptyStateComponent,
  FeedComponent,
  FeedItemComponent,
  FormFieldComponent,
  IconComponent,
  LinkComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
  SkeletonComponent,
  SplitComponent,
  StackComponent,
  TextFieldComponent,
  TextareaComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { ArchiveWorkItemDialog, WorkItemDialog, WorkItemDialogData } from '../../dialogs';
import { STATUS_LABELS, points } from '../../work-item-labels';

type State = 'loading' | 'loaded' | 'error' | 'not-found';

/**
 * One work item (L2-033): description, a story's tasks as a checklist, details with the status control,
 * and comments. Editing opens the work item dialog. Matches docs/mocks/pages/work-item.
 */
@Component({
  selector: 'ft-work-item-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    CheckboxGroupComponent,
    ClusterComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    FeedComponent,
    FeedItemComponent,
    FormFieldComponent,
    IconComponent,
    LinkComponent,
    PageHeaderComponent,
    SelectComponent,
    SkeletonComponent,
    SplitComponent,
    StackComponent,
    TextFieldComponent,
    TextareaComponent,
  ],
  templateUrl: './work-item.page.html',
  styleUrl: './work-item.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkItemPage {
  private readonly agile = inject(AGILE_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  /** The workspace id and the item id from the route. */
  readonly id = input.required<string>();
  readonly itemId = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly item = signal<WorkItemDto | null>(null);
  protected readonly workspace = signal<WorkspaceDto | null>(null);
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusOptions: SelectOption[] = (
    Object.keys(STATUS_LABELS) as WorkItemStatus[]
  ).map((s) => ({ value: s, label: STATUS_LABELS[s] }));

  protected readonly status = new FormControl<WorkItemStatus>('ToDo', { nonNullable: true });
  protected readonly done = new FormControl<string[]>([], { nonNullable: true });
  protected readonly newTask = new FormControl('', { nonNullable: true });
  protected readonly commentBody = new FormControl('', { nonNullable: true });
  protected readonly addingTask = signal(false);
  protected readonly commenting = signal(false);
  protected readonly commentError = signal('');
  /** The running sprint a backlog story can join (L2-035 AC2). */
  protected readonly activeSprint = signal<SprintDto | null>(null);
  protected readonly joining = signal(false);

  protected readonly readOnly = computed(() => this.workspace()?.access === 'Staff');
  protected readonly canWork = computed(() => this.workspace()?.canEdit ?? false);
  protected readonly doneCount = computed(
    () => this.item()?.tasks.filter((t) => t.isDone).length ?? 0,
  );
  protected readonly subtitle = computed(() => {
    const item = this.item();
    if (!item) return null;
    return item.sprint ? `${item.kind} · ${item.sprint.name}` : item.kind;
  });

  constructor() {
    effect(() => void this.load(this.itemId()));
    this.done.valueChanges.subscribe((ids) => void this.syncDone(ids));
    this.status.valueChanges.subscribe((status) => void this.move(status));
  }

  protected points = points;

  protected day(value: string): string {
    return formatDay(value);
  }

  protected retry(): void {
    void this.load(this.itemId());
  }

  protected async edit(): Promise<void> {
    const item = this.item();
    const workspace = this.workspace();
    if (!item || !workspace) return;
    const ref = this.dialogs.open<WorkItemDto | true, WorkItemDialogData>(WorkItemDialog, {
      data: { workspace, item },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({ variant: 'success', heading: `${item.kind} saved` });
    await this.reload();
  }

  /** Owner or System Admin: archive the item and what sits under it, then return to the backlog (L2-037 AC1). */
  protected async archive(): Promise<void> {
    const item = this.item();
    if (!item) return;
    const ref = this.dialogs.open<boolean>(ArchiveWorkItemDialog, { data: { item } });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({ variant: 'success', heading: `“${item.title}” archived` });
    await this.router.navigateByUrl(`/workspaces/${item.workspaceId}/backlog`);
  }

  /** The empty state's Add task: the dialog, preset to a task of this story. */
  protected async addTaskWithDialog(): Promise<void> {
    const item = this.item();
    const workspace = this.workspace();
    if (!item || !workspace) return;
    const ref = this.dialogs.open<WorkItemDto | true, WorkItemDialogData>(WorkItemDialog, {
      data: { workspace, kind: 'Task', parentId: item.id },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    await this.reload();
  }

  protected async addTask(): Promise<void> {
    const item = this.item();
    const title = this.newTask.value.trim();
    if (!item || !title || this.addingTask()) return;
    this.addingTask.set(true);
    try {
      await firstValueFrom(
        this.agile.createWorkItem(item.workspaceId, {
          kind: 'Task',
          title,
          description: '',
          parentId: item.id,
          assigneeId: null,
          storyPoints: null,
        }),
      );
      this.newTask.setValue('');
      await this.reload();
    } catch {
      this.toasts.show({ variant: 'danger', heading: 'That didn’t work', text: 'Try again.' });
    } finally {
      this.addingTask.set(false);
    }
  }

  protected async comment(): Promise<void> {
    const item = this.item();
    const body = this.commentBody.value.trim();
    this.commentError.set(body ? '' : 'Write a comment first.');
    if (!item || !body || this.commenting()) return;
    this.commenting.set(true);
    try {
      const comment = await firstValueFrom(this.agile.addComment(item.id, body));
      this.item.update((i) => (i ? { ...i, comments: [comment, ...i.comments] } : i));
      this.commentBody.setValue('');
    } catch {
      this.commentError.set('We couldn’t post your comment. Try again.');
    } finally {
      this.commenting.set(false);
    }
  }

  protected async addToSprint(): Promise<void> {
    const item = this.item();
    const sprint = this.activeSprint();
    if (!item || !sprint || this.joining()) return;
    this.joining.set(true);
    try {
      await firstValueFrom(this.agile.addStoriesToSprint(item.workspaceId, sprint.id, [item.id]));
      this.toasts.show({ variant: 'success', heading: `Added to ${sprint.name}` });
      await this.reload();
    } catch {
      this.toasts.show({ variant: 'danger', heading: 'That didn’t work', text: 'Try again.' });
    } finally {
      this.joining.set(false);
    }
  }

  private async syncDone(ids: string[]): Promise<void> {
    const item = this.item();
    if (!item) return;
    const changed = item.tasks.filter((t) => t.isDone !== ids.includes(t.id));
    this.item.set({
      ...item,
      tasks: item.tasks.map((t) => ({ ...t, isDone: ids.includes(t.id) })),
    });
    try {
      for (const task of changed) {
        await firstValueFrom(this.agile.setTaskDone(task.id, !task.isDone));
      }
    } catch {
      this.toasts.show({ variant: 'danger', heading: 'That didn’t work', text: 'Try again.' });
      await this.reload();
    }
  }

  /** The keyboard path for moving a card: change the status here (board mock note). */
  private async move(status: WorkItemStatus): Promise<void> {
    const item = this.item();
    if (!item || item.status === status) return;
    try {
      await firstValueFrom(
        this.agile.updateWorkItem(item.id, {
          title: item.title,
          description: item.description,
          assigneeId: item.assigneeId,
          storyPoints: item.storyPoints,
          status,
        }),
      );
      this.item.set({ ...item, status });
      this.toasts.show({ variant: 'success', heading: `Moved to ${STATUS_LABELS[status]}` });
    } catch {
      this.status.setValue(item.status, { emitEvent: false });
      this.toasts.show({ variant: 'danger', heading: 'That didn’t work', text: 'Try again.' });
    }
  }

  private async reload(): Promise<void> {
    const item = await firstValueFrom(this.agile.getWorkItem(this.itemId()));
    this.show(item);
  }

  private show(item: WorkItemDto): void {
    this.item.set(item);
    this.status.setValue(item.status, { emitEvent: false });
    this.done.setValue(
      item.tasks.filter((t) => t.isDone).map((t) => t.id),
      { emitEvent: false },
    );
  }

  private async load(itemId: string): Promise<void> {
    this.state.set('loading');
    try {
      const item = await firstValueFrom(this.agile.getWorkItem(itemId));
      const workspace = await firstValueFrom(this.agile.getWorkspace(item.workspaceId));
      this.workspace.set(workspace);
      if (workspace.method === 'Scrum' && item.kind === 'Story') {
        this.activeSprint.set((await firstValueFrom(this.agile.getSprints(workspace.id))).active);
      }
      this.show(item);
      if (!this.canWork()) this.done.disable({ emitEvent: false });
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }
}
