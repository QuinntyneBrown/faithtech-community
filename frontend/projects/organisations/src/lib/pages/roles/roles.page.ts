import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AUTH_SERVICE,
  CAPABILITY_LABELS,
  ORGANISATION_SERVICE,
  ROLE_DEFINITIONS_SERVICE,
  RoleDefinitionDto,
  RoleDefinitionRequest,
  hasAny,
  problemDetails,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ArchiveRoleDialogComponent,
  ArchiveRoleDialogData,
  BadgeComponent,
  ButtonComponent,
  ChecklistEntry,
  ChipComponent,
  ChipGroupComponent,
  ClusterComponent,
  DefineRoleDialogComponent,
  DefineRoleDialogData,
  DefineRoleRefusal,
  DialogService,
  EditGrantsDialogComponent,
  EditGrantsDialogData,
  EmptyStateComponent,
  ListComponent,
  ListItemComponent,
  SkeletonComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';
type Filter = 'active' | 'archived';

/**
 * The Roles tab (L2-136 AC6), matching docs/mocks/pages/organisation-roles: every role in the organisation's order with
 * its holders, a capability summary and its flags, and the archived ones read-only. Holders of ManageRoles define and
 * edit roles (L2-136 AC1, AC2), set who each may grant (L2-137) and archive an unused one (L2-136 AC4, AC5); a holder of
 * only ManageOrganisationSettings reads them (L2-147 AC2).
 */
@Component({
  selector: 'ft-roles-page',
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    ChipComponent,
    ChipGroupComponent,
    ClusterComponent,
    EmptyStateComponent,
    ListComponent,
    ListItemComponent,
    SkeletonComponent,
    StackComponent,
  ],
  templateUrl: './roles.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private readonly roles = inject(ROLE_DEFINITIONS_SERVICE);
  private readonly organisations = inject(ORGANISATION_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<State>('loading');
  protected readonly filter = signal<Filter>('active');
  protected readonly definitions = signal<RoleDefinitionDto[]>([]);
  private readonly chapterSingular = signal<string | null>(null);
  private catalogue: ChecklistEntry[] | null = null;

  protected readonly canEdit = computed(() => hasAny(this.auth.capabilities(), 'ManageRoles'));

  constructor() {
    void this.load();
    this.organisations.get().subscribe({
      next: (o) => this.chapterSingular.set(o.chapterLabel?.singular.toLowerCase() ?? null),
      error: () => undefined,
    });
  }

  protected show(filter: Filter): void {
    if (this.filter() === filter) return;
    this.filter.set(filter);
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  /** "{description} · {n} members", or the count alone. */
  protected meta(d: RoleDefinitionDto): string {
    const members = d.holderCount === 1 ? '1 member' : `${d.holderCount} members`;
    return d.description ? `${d.description} · ${members}` : members;
  }

  /** The first capabilities by name, and how many more (docs/mocks/pages/organisation-roles). */
  protected summary(d: RoleDefinitionDto): string {
    if (d.capabilities.includes('AdministerOrganisation'))
      return `${CAPABILITY_LABELS.AdministerOrganisation} (every capability)`;
    const names = d.capabilities.map((c) => CAPABILITY_LABELS[c]);
    if (names.length === 0) return 'No capabilities';
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  }

  protected heldFor(): string | null {
    const singular = this.chapterSingular();
    return singular ? `Held for a ${singular}` : null;
  }

  protected async define(): Promise<void> {
    await this.open('define');
  }

  protected async edit(definition: RoleDefinitionDto): Promise<void> {
    await this.open('edit', definition);
  }

  private async open(mode: 'define' | 'edit', definition?: RoleDefinitionDto): Promise<void> {
    const capabilities = await this.capabilities();
    const data: DefineRoleDialogData = {
      mode,
      role: definition && {
        name: definition.name,
        description: definition.description,
        capabilities: [...definition.capabilities],
        showOnTeam: definition.showOnTeam,
        isOversight: definition.isOversight,
        chapterScopable: definition.chapterScopable,
        holderCount: definition.holderCount,
      },
      capabilities,
      // The chapter switch shows only while chapters are on (L2-136 AC1).
      chapterLabel: this.chapterSingular(),
      submit: (value) =>
        this.save(definition ? this.roles.update(definition.id, value) : this.roles.define(value)),
    };
    const ref = this.dialogs.open<RoleDefinitionRequest>(
      DefineRoleDialogComponent,
      { data },
      { wide: true },
    );
    ref.closed.subscribe((saved) => {
      if (!saved) return;
      this.toasts.show(
        definition
          ? {
              variant: 'success',
              heading: 'Role saved',
              text: `Holders of ${saved.name} have the change on their next request.`,
            }
          : { variant: 'success', heading: 'Role defined', text: `${saved.name} is ready.` },
      );
      void this.load();
    });
  }

  /** Who may grant: every other active role, administration out of reach for a grantor that lacks it (L2-137). */
  protected grants(definition: RoleDefinitionDto): void {
    const administers = (d: RoleDefinitionDto) => d.capabilities.includes('AdministerOrganisation');
    const data: EditGrantsDialogData = {
      grantor: definition.name,
      canAssign: definition.capabilities.some(
        (c) => c === 'AssignRoles' || c === 'AdministerOrganisation',
      ),
      roles: this.definitions()
        .filter((d) => d.id !== definition.id)
        .map((d) => ({
          value: d.id,
          label: d.name,
          description: d.description,
          disabledReason:
            administers(d) && !administers(definition)
              ? 'Only administrators can grant administration'
              : undefined,
        })),
      granted: definition.grantableRoleIds,
      submit: (ids) => this.refusal(this.roles.setGrants(definition.id, ids)),
    };
    this.dialogs.open<string[]>(EditGrantsDialogComponent, { data }).closed.subscribe((saved) => {
      if (!saved) return;
      const count = saved.length === 1 ? '1 role' : `${saved.length} roles`;
      this.toasts.show({
        variant: 'success',
        heading: 'Grant rules saved',
        text: `${definition.name} holders can add and remove ${count}.`,
      });
      void this.load();
    });
  }

  /** Archive {role}?: refused with the reason while anything still uses it (L2-136 AC4, AC5). */
  protected archive(definition: RoleDefinitionDto): void {
    const data: ArchiveRoleDialogData = {
      role: definition.name,
      submit: () => this.refusal(this.roles.archive(definition.id)),
    };
    this.dialogs.open<boolean>(ArchiveRoleDialogComponent, { data }).closed.subscribe((done) => {
      if (!done) return;
      this.toasts.show({
        variant: 'success',
        heading: `${definition.name} archived`,
        text: 'It’s listed under Archived, read-only.',
      });
      void this.load();
    });
  }

  /** A grants or archive refusal: a 400's first field error or a 403 or 409 detail; throws when unreachable. */
  private async refusal(request: ReturnType<typeof this.roles.archive>): Promise<string | null> {
    try {
      await firstValueFrom(request);
      return null;
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) throw error;
      const problem = problemDetails(error);
      const field = problem?.errors && Object.values(problem.errors)[0]?.[0];
      if (error.status === 400 && field) return field;
      if (error.status === 403 || error.status === 409)
        return problem?.detail ?? 'You can’t change roles.';
      throw error;
    }
  }

  /** Maps the API's answer onto the dialog: null when saved, a refusal to show, or a throw when unreachable. */
  private async save(
    request: ReturnType<typeof this.roles.define>,
  ): Promise<DefineRoleRefusal | null> {
    try {
      await firstValueFrom(request);
      return null;
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) throw error;
      const problem = problemDetails(error);
      if (error.status === 400 && problem?.errors) {
        return {
          errors: {
            name: problem.errors['Name']?.[0],
            description: problem.errors['Description']?.[0],
            capabilities: problem.errors['Capabilities']?.[0],
          },
        };
      }
      if (error.status === 403 || error.status === 409) {
        return { message: problem?.detail ?? 'You can’t change roles.' };
      }
      throw error;
    }
  }

  private async capabilities(): Promise<ChecklistEntry[]> {
    this.catalogue ??= (await firstValueFrom(this.roles.capabilities())).map((c) => ({
      value: c.key,
      label: CAPABILITY_LABELS[c.key],
      description: c.description,
    }));
    return this.catalogue;
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.definitions.set(await firstValueFrom(this.roles.list(this.filter() === 'archived')));
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
