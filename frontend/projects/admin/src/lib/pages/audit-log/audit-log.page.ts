import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AUDIT_LOG_SERVICE,
  AUTH_SERVICE,
  AuditCategory,
  AuditEntry,
  AuditFilters,
  Capability,
  OrganisationNames,
} from '@faithtech-community/api';
import {
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  ClusterComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
  TabComponent,
  TableColumn,
  TableComponent,
  TabsComponent,
  ToastService,
  formatTimestamp,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error' | 'forbidden';

interface Category {
  value: AuditCategory;
  label: string;
  /** The capability that reads it besides AdministerOrganisation, for the settings categories (L2-152 AC3). */
  readBy?: Capability;
}

const CATEGORIES: Category[] = [
  { value: 'roles', label: 'Roles', readBy: 'ManageRoles' },
  { value: 'suspensions', label: 'Suspensions' },
  { value: 'contacts', label: 'Private contact access' },
  { value: 'deletions', label: 'Deletions' },
  { value: 'organisation', label: 'Organisation', readBy: 'ManageOrganisationSettings' },
  { value: 'chapters', label: 'Chapters', readBy: 'ManageOrganisationSettings' },
  { value: 'taxonomies', label: 'Stages & types', readBy: 'ManageOrganisationSettings' },
];

/** "A", "A and B", "A, B and C". */
function listOf(labels: string[]): string {
  return labels.length < 2
    ? labels.join('')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * The audit log (L2-041, L2-152), matching docs/mocks/pages/audit-log. An administrator reads every category under
 * Admin; a holder of ManageRoles or ManageOrganisationSettings reads only the categories they may change, at
 * /organisation/audit (mock `partial`), where the route's `context` is `organisation`.
 */
@Component({
  selector: 'ft-audit-log-page',
  imports: [
    ReactiveFormsModule,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    ClusterComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    PageHeaderComponent,
    SelectComponent,
    TabComponent,
    TableComponent,
    TabsComponent,
  ],
  templateUrl: './audit-log.page.html',
  styleUrl: './audit-log.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPage {
  private readonly audit = inject(AUDIT_LOG_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly names = inject(OrganisationNames);

  /** Opened from the Organisation section rather than Admin (L2-152 AC3). */
  protected readonly inOrganisation =
    inject(ActivatedRoute).snapshot.data['context'] === 'organisation';
  private readonly administrator = computed(() =>
    this.auth.capabilities().includes('AdministerOrganisation'),
  );
  /** The categories the caller may read, the chapters one under the organisation's own label. */
  private readonly readable = computed(() => {
    const held = this.auth.capabilities();
    const plural = this.names.chapterLabel()?.plural;
    return CATEGORIES.filter(
      (c) => this.administrator() || (c.readBy !== undefined && held.includes(c.readBy)),
    ).map((c) => (c.value === 'chapters' && plural ? { ...c, label: plural } : c));
  });
  protected readonly categories = computed<SelectOption[]>(() => [
    { value: '', label: this.administrator() ? 'All actions' : 'Everything you can see' },
    ...this.readable().map((c) => ({ value: c.value, label: c.label })),
  ]);
  protected readonly scopeLine = computed(
    () =>
      `You can see the settings you can change: ${listOf(this.readable().map((c) => c.label))}.`,
  );
  protected readonly category = new FormControl('', { nonNullable: true });
  protected readonly columns: TableColumn[] = [
    { key: 'when', header: 'When', mono: true },
    { key: 'who', header: 'Who' },
    { key: 'what', header: 'What' },
  ];

  protected readonly state = signal<State>('loading');
  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly loadingMore = signal(false);
  protected readonly exporting = signal(false);
  private readonly page = signal(1);
  private readonly selected = signal<AuditCategory | null>(null);
  /**
   * Bumped by every new load (category change, retry); a response that belongs to an older one is
   * dropped, so out-of-order answers never mix with the entries on screen.
   */
  private generation = 0;

  protected readonly rows = computed(() =>
    this.entries().map((e) => ({
      when: formatTimestamp(e.occurredAtUtc),
      who: e.actorName,
      what: e.summary,
    })),
  );
  protected readonly hasMore = computed(() => this.entries().length < this.total());
  protected readonly noResultsHeading = computed(() => {
    const label = this.readable().find((c) => c.value === this.selected())?.label ?? '';
    return `No ${label.toLowerCase()} in the last 90 days`;
  });

  constructor() {
    this.category.valueChanges.subscribe((value) => {
      this.selected.set((value || null) as AuditCategory | null);
      void this.load();
    });
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected showAll(): void {
    this.category.setValue('');
  }

  protected async loadMore(): Promise<void> {
    if (this.loadingMore()) return;
    const generation = this.generation;
    this.loadingMore.set(true);
    try {
      const next = this.page() + 1;
      const result = await firstValueFrom(this.audit.getEntries(this.filters(), next));
      if (generation !== this.generation) return;
      this.entries.update((entries) => [...entries, ...result.items]);
      this.total.set(result.totalCount);
      this.page.set(next);
    } catch {
      if (generation === this.generation) this.state.set('error');
    } finally {
      if (generation === this.generation) this.loadingMore.set(false);
    }
  }

  protected async exportCsv(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const blob = await firstValueFrom(this.audit.exportCsv(this.filters()));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audit-log.csv';
      link.click();
      URL.revokeObjectURL(url);
      this.toasts.show({
        variant: 'success',
        heading: 'Audit log exported',
        text: 'audit-log.csv is in your downloads.',
      });
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t export the audit log',
        text: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () => void this.exportCsv(),
      });
    } finally {
      this.exporting.set(false);
    }
  }

  private filters(): AuditFilters {
    return { category: this.selected() };
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.state.set('loading');
    this.loadingMore.set(false);
    try {
      const result = await firstValueFrom(this.audit.getEntries(this.filters(), 1));
      if (generation !== this.generation) return;
      this.entries.set(result.items);
      this.total.set(result.totalCount);
      this.page.set(1);
      this.state.set('loaded');
    } catch (error) {
      if (generation !== this.generation) return;
      const forbidden = error instanceof HttpErrorResponse && error.status === 403;
      this.state.set(forbidden ? 'forbidden' : 'error');
    }
  }
}
