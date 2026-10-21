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
  AdminUserSummary,
  ROLE_LABELS,
  Role,
  UserStatus,
} from '@faithtech-community/api';
import {
  AvatarComponent,
  BadgeComponent,
  BadgeVariant,
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  LinkComponent,
  PageHeaderComponent,
  SkeletonComponent,
  StackComponent,
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
    ReactiveFormsModule,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ClusterComponent,
    EmptyStateComponent,
    LinkComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StackComponent,
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
  private readonly users = inject(ADMIN_USERS_SERVICE);
  private readonly dialogs = inject(DialogService);

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
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly term = signal('');
  protected readonly state = signal<State>('loading');
  protected readonly list = signal<AdminUserSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly loadingMore = signal(false);
  protected readonly working = signal<string | null>(null);
  private readonly page = signal(1);

  protected readonly rows = computed(() => this.list() as unknown as Record<string, unknown>[]);
  protected readonly hasMore = computed(() => this.list().length < this.total());

  constructor() {
    void this.load();
  }

  protected roleLabel(role: Role): string {
    return ROLE_LABELS[role];
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
    this.loadingMore.set(true);
    try {
      const next = this.page() + 1;
      const result = await firstValueFrom(this.users.search(this.term(), next));
      this.list.update((list) => [...list, ...result.items]);
      this.total.set(result.totalCount);
      this.page.set(next);
    } catch {
      this.state.set('error');
    } finally {
      this.loadingMore.set(false);
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
    this.state.set('loading');
    try {
      const result = await firstValueFrom(this.users.search(this.term(), 1));
      this.list.set(result.items);
      this.total.set(result.totalCount);
      this.page.set(1);
      this.state.set('loaded');
    } catch (error) {
      const forbidden = error instanceof HttpErrorResponse && error.status === 403;
      this.state.set(forbidden ? 'forbidden' : 'error');
    }
  }
}
