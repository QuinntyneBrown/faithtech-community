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
 * edit roles (L2-136 AC1, AC2); a holder of only ManageOrganisationSettings reads them (L2-147 AC2). Archive and
 * Who may grant join in slice 17.
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
        holderCount: definition.holderCount,
      },
      capabilities,
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
