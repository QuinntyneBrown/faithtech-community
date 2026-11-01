import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AGILE_SERVICE,
  ArchivedItemDto,
  WorkspaceDto,
  WorkspaceMemberDto,
  WorkspaceMethod,
  problemDetails,
  OrganisationRoles,
} from '@faithtech-community/api';
import {
  AlertComponent,
  AvatarComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  DangerZoneComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  DialogService,
  EmptyStateComponent,
  ErrorSummaryComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  IconComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  StackComponent,
  TextFieldComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  AddWorkspaceMembersDialog,
  ArchiveWorkspaceDialog,
  ReassignOwnerDialog,
  RemoveWorkspaceMemberDialog,
  SwitchMethodData,
  SwitchMethodDialog,
} from '../../dialogs';
import { KIND_BADGES } from '../../work-item-labels';
import { WorkspaceFrameComponent } from '../workspace-frame';

type State = 'loading' | 'loaded' | 'error' | 'not-found';

/**
 * The owner's settings (L2-051): the name, the method (L2-036), the members (L2-031 AC2, AC8), archived items
 * and archiving the workspace (L2-037 AC1). System Admin sees the same and, when the owner lost City Lead,
 * reassigns ownership (L2-037 AC2). Anyone who reads but does not manage the workspace sees that only the owner
 * changes settings. Matches docs/mocks/pages/workspace-settings.
 */
@Component({
  selector: 'ft-workspace-settings-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    DangerZoneComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
    IconComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    StackComponent,
    TextFieldComponent,
    WorkspaceFrameComponent,
  ],
  templateUrl: './workspace-settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceSettingsPage {
  private readonly organisationRoles = inject(OrganisationRoles);
  private readonly agile = inject(AGILE_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly errorFocus = viewChild(FormErrorFocusDirective);
  private readonly nameField = viewChild('nameField', { read: FormFieldComponent });

  /** The workspace id from the route. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly workspace = signal<WorkspaceDto | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({ name: [''] });
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly nameError = signal('');
  protected readonly archived = signal<ArchivedItemDto[]>([]);
  protected readonly kindBadges = KIND_BADGES;

  /** Members may still write stories and cards; Staff only read (L2-051 AC3, L2-031 AC5). */
  protected readonly ownerOnlyText = computed(() => {
    const ws = this.workspace();
    if (!ws) return '';
    const owns = `${ws.ownerName} owns this workspace.`;
    return ws.canEdit
      ? `${owns} You can still add stories, move cards and vote in Planning Poker.`
      : owns;
  });

  protected readonly subtitle = computed(() => {
    const access = this.workspace()?.access;
    return access === 'Owner'
      ? 'Settings · only you, the owner, can change these'
      : access === 'Admin'
        ? 'Settings · you’re changing these as System Admin, and each change is recorded in the audit log'
        : 'Settings';
  });
  protected readonly summary = computed<FormError[]>(() =>
    this.nameError()
      ? [{ message: 'Enter a name', fieldId: this.nameField()?.controlId() ?? '' }]
      : [],
  );

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected title(member: WorkspaceMemberDto): string {
    return member.isOwner ? `${member.name} (${this.ownerSuffix()})` : member.name;
  }

  protected roles(member: WorkspaceMemberDto): string {
    return member.roles.map((r) => this.organisationRoles.label(r)).join(', ');
  }

  protected retry(): void {
    void this.load(this.id());
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    const name = this.form.getRawValue().name.trim();
    this.nameError.set(name ? '' : 'Give the workspace a name your team will recognise.');
    this.saveFailed.set(false);
    if (this.nameError()) {
      this.errorFocus()?.focusFirstError();
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.agile.renameWorkspace(this.id(), name));
      this.workspace.update((w) => (w ? { ...w, name } : w));
      this.toasts.show({ variant: 'success', heading: 'Settings saved' });
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.nameError.set(problemDetails(error)?.errors?.['Name']?.[0] ?? '');
        this.errorFocus()?.focusFirstError();
      } else {
        this.saveFailed.set(true);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async addMembers(): Promise<void> {
    const workspace = this.workspace();
    if (!workspace) return;
    const ref = this.dialogs.open<string[]>(AddWorkspaceMembersDialog, { data: workspace });
    const added = await firstValueFrom(ref.closed);
    if (!added?.length) return;
    this.toasts.show({
      variant: 'success',
      heading: added.length === 1 ? `${added[0]} added` : `${added.length} members added`,
      text: 'They’ll get an in-app notification and an email.',
    });
    await this.reload();
  }

  protected async remove(member: WorkspaceMemberDto): Promise<void> {
    const workspace = this.workspace();
    if (!workspace) return;
    const ref = this.dialogs.open<boolean>(RemoveWorkspaceMemberDialog, {
      data: { workspace, member },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({ variant: 'success', heading: `${member.name} removed` });
    await this.reload();
  }

  protected async switchMethod(): Promise<void> {
    const workspace = this.workspace();
    if (!workspace) return;
    const activeSprintName =
      workspace.method === 'Scrum'
        ? ((await firstValueFrom(this.agile.getSprints(workspace.id))).active?.name ?? null)
        : null;
    const ref = this.dialogs.open<WorkspaceMethod, SwitchMethodData>(SwitchMethodDialog, {
      data: { workspace, activeSprintName },
    });
    const method = await firstValueFrom(ref.closed);
    if (!method) return;
    this.toasts.show({ variant: 'success', heading: `${workspace.name} now uses ${method}` });
    await this.reload();
  }

  protected archivedMeta(item: ArchivedItemDto): string {
    return `Archived ${formatDay(item.archivedAt)} by ${item.archivedByName}`;
  }

  protected async restore(item: ArchivedItemDto): Promise<void> {
    try {
      await firstValueFrom(this.agile.restoreWorkItem(item.id));
      this.toasts.show({ variant: 'success', heading: `“${item.title}” restored` });
      await this.reload();
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'That didn’t work',
        text: `We couldn’t restore “${item.title}”. Try again.`,
      });
    }
  }

  protected async archiveWorkspace(): Promise<void> {
    const workspace = this.workspace();
    if (!workspace) return;
    const ref = this.dialogs.open<boolean>(ArchiveWorkspaceDialog, { data: { workspace } });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({ variant: 'success', heading: `${workspace.name} archived` });
    await this.router.navigateByUrl('/workspaces');
  }

  protected async reassignOwner(): Promise<void> {
    const workspace = this.workspace();
    if (!workspace) return;
    const ref = this.dialogs.open<string>(ReassignOwnerDialog, { data: { workspace } });
    const owner = await firstValueFrom(ref.closed);
    if (owner === undefined) return;
    this.toasts.show({ variant: 'success', heading: `${owner} now owns ${workspace.name}` });
    await this.reload();
  }

  protected other(method: WorkspaceMethod): WorkspaceMethod {
    return method === 'Scrum' ? 'Kanban' : 'Scrum';
  }

  private ownerSuffix(): string {
    return this.workspace()?.access === 'Owner' ? 'you, owner' : 'owner';
  }

  private async reload(): Promise<void> {
    try {
      const workspace = await firstValueFrom(this.agile.getWorkspace(this.id()));
      this.workspace.set(workspace);
      this.archived.set(await this.loadArchived(workspace));
    } catch {
      this.state.set('error');
    }
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const workspace = await firstValueFrom(this.agile.getWorkspace(id));
      this.archived.set(await this.loadArchived(workspace));
      this.workspace.set(workspace);
      this.form.setValue({ name: workspace.name });
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }

  private loadArchived(workspace: WorkspaceDto): Promise<ArchivedItemDto[]> {
    return workspace.canManage
      ? firstValueFrom(this.agile.getArchivedItems(workspace.id))
      : Promise.resolve([]);
  }
}
