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
import {
  AGILE_SERVICE,
  ROLE_LABELS,
  WorkspaceDto,
  WorkspaceMemberDto,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  AvatarComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  ErrorSummaryComponent,
  FormError,
  FormErrorFocusDirective,
  FormFieldComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  StackComponent,
  TextFieldComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { AddWorkspaceMembersDialog, RemoveWorkspaceMemberDialog } from '../../dialogs';
import { WorkspaceFrameComponent } from '../workspace-frame';

type State = 'loading' | 'loaded' | 'error' | 'not-found';

/**
 * The owner's settings (L2-051): the name, the members (L2-031 AC2, AC8) and, in later sections, the method,
 * archived items and archiving. Anyone who reads but does not manage the workspace sees that only the owner
 * changes settings. Matches docs/mocks/pages/workspace-settings.
 */
@Component({
  selector: 'ft-workspace-settings-page',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AvatarComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorSummaryComponent,
    FormErrorFocusDirective,
    FormFieldComponent,
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
  private readonly agile = inject(AGILE_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
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

  protected readonly subtitle = computed(() =>
    this.workspace()?.canManage ? 'Settings · only you, the owner, can change these' : 'Settings',
  );
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
    return member.roles.map((r) => ROLE_LABELS[r]).join(', ');
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

  private ownerSuffix(): string {
    return this.workspace()?.access === 'Owner' ? 'you, owner' : 'owner';
  }

  private async reload(): Promise<void> {
    try {
      this.workspace.set(await firstValueFrom(this.agile.getWorkspace(this.id())));
    } catch {
      this.state.set('error');
    }
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const workspace = await firstValueFrom(this.agile.getWorkspace(id));
      this.workspace.set(workspace);
      this.form.setValue({ name: workspace.name });
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
      );
    }
  }
}
