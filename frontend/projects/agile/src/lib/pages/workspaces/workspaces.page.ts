import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AGILE_SERVICE,
  AUTH_SERVICE,
  WorkspaceDto,
  WorkspaceSummaryDto,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  StickerComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { CreateWorkspaceDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error';

/** The workspaces a member may see (L2-050), matching docs/mocks/pages/workspaces. */
@Component({
  selector: 'ft-workspaces-page',
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    StickerComponent,
  ],
  templateUrl: './workspaces.page.html',
  styleUrl: './workspaces.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspacesPage {
  private readonly agile = inject(AGILE_SERVICE);
  private readonly roles = inject(AUTH_SERVICE).roles;
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<State>('loading');
  protected readonly list = signal<WorkspaceSummaryDto[]>([]);

  /** City Leads and System Admins create workspaces (L2-031 AC1). */
  protected readonly canCreate = computed(() =>
    this.roles().some((r) => r === 'CityLead' || r === 'SystemAdmin'),
  );
  protected readonly isStaff = computed(
    () => this.roles().includes('Staff') && !this.roles().includes('SystemAdmin'),
  );
  protected readonly subtitle = computed(() => {
    if (this.isStaff()) return 'Every workspace, read-only';
    if (this.roles().includes('SystemAdmin')) return 'Every workspace';
    return this.canCreate() ? 'Workspaces you own or belong to' : 'Workspaces you’ve been added to';
  });

  constructor() {
    void this.load();
  }

  /** "Owner: Grace Okonkwo · Scrum · Sprint 7 active · 5 members", as the mock words it. */
  protected meta(workspace: WorkspaceSummaryDto): string {
    const parts = [`Owner: ${workspace.ownerName}`, workspace.method];
    if (workspace.method === 'Scrum') {
      parts.push(
        workspace.activeSprintName ? `${workspace.activeSprintName} active` : 'no active sprint',
      );
    }
    parts.push(`${workspace.memberCount} ${workspace.memberCount === 1 ? 'member' : 'members'}`);
    return parts.join(' · ');
  }

  protected retry(): void {
    void this.load();
  }

  protected async create(): Promise<void> {
    const ref = this.dialogs.open<WorkspaceDto>(CreateWorkspaceDialog, {});
    const created = await firstValueFrom(ref.closed);
    if (!created) return;
    this.toasts.show({ variant: 'success', heading: `${created.name} created` });
    await this.load();
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.list.set(await firstValueFrom(this.agile.listWorkspaces()));
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
