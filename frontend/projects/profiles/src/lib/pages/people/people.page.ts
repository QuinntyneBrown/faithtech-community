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
  AUTH_SERVICE,
  ORGANISATION_SERVICE,
  PEOPLE_SERVICE,
  PersonSummary,
  ROLES_SERVICE,
  chapterFilterOptions,
  hasAny,
  roleBadge,
} from '@faithtech-community/api';
import {
  avatarColorFor,
  AvatarComponent,
  BadgeComponent,
  ButtonComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  LinkComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
  TableColumn,
  TableComponent,
  TextFieldComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  RoleMode,
  addableRoles,
  injectRoleChoices,
  openRoleDialog,
  removableRoles,
} from '../../role-actions';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

/** A member row with the actions the caller may take on it (L2-009). */
interface PersonRow extends PersonSummary {
  canAdd: boolean;
  canRemove: boolean;
  /** Holds a role only an administrator may change. */
  locked: boolean;
}

/**
 * The people directory for City Leads, Staff and System Admins (L2-053), matching
 * docs/mocks/pages/people. Role changes go through the shared role dialog (ADR 0005). The chapter filter and column
 * follow the organisation's chapter label, and are absent while chapters are off (L2-142, chapters-off mock).
 */
@Component({
  selector: 'ft-people-page',
  imports: [
    ReactiveFormsModule,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    ClusterComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    LinkComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    SelectComponent,
    TableComponent,
    TextFieldComponent,
  ],
  templateUrl: './people.page.html',
  styleUrl: './people.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeoplePage {
  private readonly people = inject(PEOPLE_SERVICE);
  private readonly rolesService = inject(ROLES_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly capabilities = inject(AUTH_SERVICE).capabilities;
  private readonly organisations = inject(ORGANISATION_SERVICE);
  /** The roles the caller may change (L2-137 AC5). */
  private readonly choices = injectRoleChoices();
  /** "{role} · {chapter}" for a tagged assignment (L2-141 AC3). */
  protected readonly badge = roleBadge;

  private readonly memberCell = viewChild.required<TemplateRef<unknown>>('memberCell');
  private readonly rolesCell = viewChild.required<TemplateRef<unknown>>('rolesCell');
  private readonly actionCell = viewChild.required<TemplateRef<unknown>>('actionCell');

  /** "All {chapters}" and the chapters, or none while chapters are off. */
  protected readonly chapterOptions = signal<SelectOption[]>([]);
  protected readonly chapterLabel = signal('');
  protected readonly chapter = new FormControl('', { nonNullable: true });
  private readonly selectedChapter = signal<string | null>(null);

  protected readonly columns = computed<TableColumn[]>(() => [
    { key: 'name', header: 'Member', template: this.memberCell() },
    { key: 'roles', header: 'Roles', template: this.rolesCell() },
    ...(this.chapterLabel() ? [{ key: 'chapterName', header: this.chapterLabel() }] : []),
    { key: 'actions', header: 'Actions', hideHeader: true, template: this.actionCell() },
  ]);

  /** "No one matches “x”", "No one in Toronto yet" or both, as the no-results mock words it (L2-142 AC5). */
  protected readonly noResultsHeading = computed(() => {
    const id = this.selectedChapter();
    const chapter = id && this.chapterOptions().find((o) => o.value === id)?.label;
    const term = this.term();
    if (chapter && !term) return `No one in ${chapter} yet`;
    return chapter ? `No one matches “${term}” in ${chapter}` : `No one matches “${term}”`;
  });

  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly term = signal('');
  protected readonly state = signal<State>('loading');
  protected readonly list = signal<PersonSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly loadingMore = signal(false);
  private readonly page = signal(1);
  private request = 0;

  /** AssignRoles manages roles; a viewer of the directory reads it (L2-053 AC2, L2-135 AC7). */
  protected readonly canManage = computed(() => hasAny(this.capabilities(), 'AssignRoles'));
  protected readonly subtitle = computed(() => {
    if (this.capabilities().includes('AdministerOrganisation')) {
      return 'As an administrator you can assign any role.';
    }
    if (this.canManage()) {
      const { roles, grantableRoleIds } = this.choices();
      const names = roles.filter((r) => grantableRoleIds.includes(r.id)).map((r) => r.name);
      if (names.length === 0) return 'Your roles can’t add or remove any role.';
      const list =
        names.length > 1
          ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
          : names[0];
      return `You can add or remove ${list}.`;
    }
    return 'Read-only for Staff.';
  });

  protected readonly rows = computed(() => {
    const choices = this.choices();
    const manage = this.canManage();
    return this.list().map<PersonRow>((p) => ({
      ...p,
      canAdd: addableRoles(choices, p).length > 0,
      canRemove: removableRoles(choices, p).length > 0,
      locked: manage && p.roles.some((r) => !choices.grantableRoleIds.includes(r.id)),
    })) as unknown as Record<string, unknown>[];
  });
  protected readonly hasMore = computed(() => this.list().length < this.total());

  constructor() {
    this.chapter.valueChanges.subscribe((value) => {
      this.selectedChapter.set(value || null);
      void this.load();
    });
    this.organisations.get().subscribe({
      next: (organisation) => {
        this.chapterOptions.set(chapterFilterOptions(organisation));
        this.chapterLabel.set(organisation.chapterLabel?.singular ?? '');
      },
      error: () => this.chapterOptions.set([]),
    });
    void this.load();
  }

  protected avatarColor(person: PersonSummary) {
    return avatarColorFor(person.id);
  }

  protected search(): void {
    this.term.set(this.query.value.trim());
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected changeRoles(person: PersonSummary, mode: RoleMode): void {
    openRoleDialog(this.dialogs, this.rolesService, this.choices(), person, mode, (roles) =>
      this.list.update((list) => list.map((p) => (p.id === person.id ? { ...p, roles } : p))),
    );
  }

  protected async loadMore(): Promise<void> {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    try {
      const next = this.page() + 1;
      const result = await firstValueFrom(
        this.people.search(this.term(), next, this.selectedChapter()),
      );
      this.list.update((list) => [...list, ...result.items]);
      this.total.set(result.totalCount);
      this.page.set(next);
    } catch {
      this.state.set('error');
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async load(): Promise<void> {
    // Only the latest search may update the page, so a slow answer never overwrites a newer one.
    const request = ++this.request;
    this.state.set('loading');
    try {
      const result = await firstValueFrom(
        this.people.search(this.term(), 1, this.selectedChapter()),
      );
      if (request !== this.request) return;
      this.list.set(result.items);
      this.total.set(result.totalCount);
      this.page.set(1);
      this.state.set('loaded');
    } catch (error) {
      if (request !== this.request) return;
      const forbidden = error instanceof HttpErrorResponse && error.status === 403;
      this.state.set(forbidden ? 'forbidden' : 'error');
    }
  }
}
