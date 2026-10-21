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
import {
  AGILE_SERVICE,
  BacklogFilter,
  BacklogNodeDto,
  WorkItemDto,
  WorkspaceDto,
} from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  ListSkeletonComponent,
  SelectComponent,
  SelectOption,
  ToastService,
  TreeComponent,
  TreeItemComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { WorkItemDialog, WorkItemDialogData } from '../../dialogs';
import { KIND_BADGES, STATUS_LABELS, firstName, flatten, points } from '../../work-item-labels';
import { WorkspaceFrameComponent } from '../workspace-frame';

type State = 'loading' | 'loaded' | 'error' | 'not-found';

/**
 * The backlog (L2-032 AC4): initiatives, epics, stories and tasks as an expandable tree, filtered by
 * initiative or epic. Matches docs/mocks/pages/backlog.
 */
@Component({
  selector: 'ft-backlog-page',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    ListSkeletonComponent,
    SelectComponent,
    TreeComponent,
    TreeItemComponent,
    WorkspaceFrameComponent,
  ],
  templateUrl: './backlog.page.html',
  styleUrl: './backlog.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacklogPage {
  private readonly agile = inject(AGILE_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly workspace = signal<WorkspaceDto | null>(null);
  protected readonly tree = signal<BacklogNodeDto[]>([]);
  protected readonly filter = new FormControl('', { nonNullable: true });
  protected readonly kindBadges = KIND_BADGES;
  /** Initiatives and epics from the whole backlog, so filtering never empties the list of choices. */
  private readonly planning = signal<BacklogNodeDto[]>([]);

  protected readonly filterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All initiatives and epics' },
    ...this.planning().map((n) => ({
      value: `${n.kind === 'Initiative' ? 'initiativeId' : 'epicId'}:${n.id}`,
      label: `${n.kind}: ${n.title}`,
    })),
    { value: 'noEpic', label: 'No epic' },
  ]);

  constructor() {
    effect(() => void this.load(this.id()));
    this.filter.valueChanges.subscribe(() => void this.loadTree());
  }

  protected href(node: BacklogNodeDto): string {
    return `/workspaces/${this.id()}/items/${node.id}`;
  }

  /** "2 epics", "No initiative · 1 story", "In Progress · 8 pts", "Done · Marcus", as the mock words them. */
  protected meta(node: BacklogNodeDto, root: boolean): string {
    const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    switch (node.kind) {
      case 'Initiative':
        return count(node.children.length, 'epic', 'epics');
      case 'Epic': {
        const stories = count(node.children.length, 'story', 'stories');
        return root ? `No initiative · ${stories}` : stories;
      }
      case 'Story': {
        const line = `${STATUS_LABELS[node.status]} · ${points(node.storyPoints)}`;
        return root ? `No epic · ${line}` : line;
      }
      case 'Task':
        return [node.isDone ? 'Done' : 'To Do', firstName(node.assigneeName)]
          .filter(Boolean)
          .join(' · ');
    }
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected async newItem(): Promise<void> {
    const workspace = this.workspace();
    if (!workspace) return;
    const ref = this.dialogs.open<WorkItemDto | true, WorkItemDialogData>(WorkItemDialog, {
      data: { workspace },
    });
    const created = await firstValueFrom(ref.closed);
    if (!created || created === true) return;
    this.toasts.show({ variant: 'success', heading: `${created.title} created` });
    await this.loadTree(true);
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      this.workspace.set(await firstValueFrom(this.agile.getWorkspace(id)));
      await this.loadTree(true);
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }

  private async loadTree(refreshFilters = false): Promise<void> {
    try {
      if (refreshFilters) {
        const all = await firstValueFrom(this.agile.getBacklog(this.id()));
        this.planning.set(flatten(all).filter((n) => n.kind === 'Initiative' || n.kind === 'Epic'));
      }
      this.tree.set(await firstValueFrom(this.agile.getBacklog(this.id(), this.chosenFilter())));
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }

  private chosenFilter(): BacklogFilter {
    const value = this.filter.value;
    if (value === 'noEpic') return { noEpic: true };
    const [key, id] = value.split(':');
    if (key === 'initiativeId') return { initiativeId: id };
    if (key === 'epicId') return { epicId: id };
    return {};
  }
}
