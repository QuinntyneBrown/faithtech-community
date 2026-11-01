import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ADMIN_USERS_SERVICE,
  AGILE_SERVICE,
  AdminUserSummary,
  Role,
  UserStatus,
  WorkspaceSummaryDto,
  OrganisationRoles,
} from '@faithtech-community/api';
import {
  AvatarColor,
  avatarColorFor,
  AlertComponent,
  AvatarComponent,
  BadgeComponent,
  BadgeVariant,
  ButtonComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  LinkComponent,
  PageHeaderComponent,
  ListSkeletonComponent,
  TabComponent,
  TableColumn,
  TableComponent,
  TabsComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { SuspendUserData, SuspendUserDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

const STATUS_BADGES: Record<UserStatus, BadgeVariant> = {
  Active: 'success',
  Suspended: 'danger',
  Unverified: 'warning',
};

/** Every account for System Admins (L2-040, L2-039), matching docs/mocks/pages/admin-users. */
@Component({
  selector: 'ft-admin-users-page',
  imports: [
    AlertComponent,
    ReactiveFormsModule,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    ClusterComponent,
    EmptyStateComponent,
    LinkComponent,
    PageHeaderComponent,
    ListSkeletonComponent,
    TabComponent,
    TableComponent,
    TabsComponent,
    TextFieldComponent,
  ],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPage {
  private readonly organisationRoles = inject(OrganisationRoles);
  private readonly users = inject(ADMIN_USERS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly agile = inject(AGILE_SERVICE);

  /** Live workspaces whose owner lost City Lead; System Admin reassigns them from settings (L2-037 AC2). */
  protected readonly needsOwner = signal<WorkspaceSummaryDto[]>([]);

  private readonly nameCell = viewChild.required<TemplateRef<unknown>>('nameCell');
  private readonly rolesCell = viewChild.required<TemplateRef<unknown>>('rolesCell');
  private readonly statusCell = viewChild.required<TemplateRef<unknown>>('statusCell');
  private readonly actionCell = viewChild.required<TemplateRef<unknown>>('actionCell');

  protected readonly columns = computed<TableColumn[]>(() => [
    { key: 'name', header: 'Name', template: this.nameCell() },
    { key: 'email', header: 'Email' },
    { key: 'roles', header: 'Roles', template: this.rolesCell() },
    { key: 'status', header: 'Status', template: this.statusCell() },
    { key: 'action', header: 'Actions', hideHeader: true, template: this.actionCell() },
  ]);

  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly term = signal('');
  protected readonly state = signal<State>('loading');
  protected readonly list = signal<AdminUserSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly loadingMore = signal(false);
  protected readonly working = signal<string | null>(null);
  private readonly page = signal(1);
  /**
   * Bumped by every new search; a response (first page or show-more) that belongs to an older
   * search is dropped, so out-of-order answers never mix with the rows on screen.
   */
  private generation = 0;

  protected readonly rows = computed(() => this.list() as unknown as Record<string, unknown>[]);
  protected readonly hasMore = computed(() => this.list().length < this.total());

  constructor() {
    void this.load();
    void this.loadWorkspacesNeedingOwner();
  }

  /** A suspended account shows the plain avatar (ADR 0008). */
  protected avatarColor(user: AdminUserSummary): AvatarColor {
    return user.status === 'Suspended' ? 'plain' : avatarColorFor(user.id);
  }

  protected roleLabel(role: Role): string {
    return this.organisationRoles.label(role);
  }

  protected badge(status: UserStatus): BadgeVariant {
    return STATUS_BADGES[status];
  }

  protected search(): void {
    this.term.set(this.query.value.trim());
    void this.load();
  }

  protected clear(): void {
    this.query.setValue('');
    this.search();
  }

  protected retry(): void {
    void this.load();
  }

  protected async loadMore(): Promise<void> {
    if (this.loadingMore()) return;
    const generation = this.generation;
    this.loadingMore.set(true);
    try {
      const next = this.page() + 1;
      const result = await firstValueFrom(this.users.search(this.term(), next));
      if (generation !== this.generation) return;
      this.list.update((list) => [...list, ...result.items]);
      this.total.set(result.totalCount);
      this.page.set(next);
    } catch {
      if (generation === this.generation) this.state.set('error');
    } finally {
      if (generation === this.generation) this.loadingMore.set(false);
    }
  }

  protected async suspend(user: AdminUserSummary): Promise<void> {
    const ref = this.dialogs.open<boolean, SuspendUserData>(SuspendUserDialog, {
      data: { id: user.id, name: user.name },
    });
    if (await firstValueFrom(ref.closed)) this.setStatus(user.id, 'Suspended');
  }

  protected async reinstate(user: AdminUserSummary): Promise<void> {
    if (this.working()) return;
    this.working.set(user.id);
    try {
      await firstValueFrom(this.users.reinstate(user.id));
      this.setStatus(user.id, 'Active');
    } catch {
      this.state.set('error');
    } finally {
      this.working.set(null);
    }
  }

  private setStatus(id: string, status: UserStatus): void {
    this.list.update((list) => list.map((u) => (u.id === id ? { ...u, status } : u)));
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.state.set('loading');
    this.loadingMore.set(false);
    try {
      const result = await firstValueFrom(this.users.search(this.term(), 1));
      if (generation !== this.generation) return;
      this.list.set(result.items);
      this.total.set(result.totalCount);
      this.page.set(1);
      this.state.set('loaded');
    } catch (error) {
      if (generation !== this.generation) return;
      const forbidden = error instanceof HttpErrorResponse && error.status === 403;
      this.state.set(forbidden ? 'forbidden' : 'error');
    }
  }

  private async loadWorkspacesNeedingOwner(): Promise<void> {
    try {
      const workspaces = await firstValueFrom(this.agile.listWorkspaces());
      this.needsOwner.set(workspaces.filter((w) => w.needsNewOwner && !w.isArchived));
    } catch {
      // The users list still works; the reminder also reaches System Admin as a notification.
    }
  }
}
