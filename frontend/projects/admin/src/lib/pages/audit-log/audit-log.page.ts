import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  AUDIT_LOG_SERVICE,
  AuditCategory,
  AuditEntry,
  AuditFilters,
} from '@faithtech-community/api';
import {
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

const CATEGORIES: SelectOption[] = [
  { value: '', label: 'All actions' },
  { value: 'roles', label: 'Role changes' },
  { value: 'suspensions', label: 'Suspensions' },
  { value: 'contacts', label: 'Private contact access' },
  { value: 'deletions', label: 'Deletions' },
];

/** The audit log for System Admins (L2-041), matching docs/mocks/pages/audit-log. */
@Component({
  selector: 'ft-audit-log-page',
  imports: [
    ReactiveFormsModule,
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

  protected readonly categories = CATEGORIES;
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

  protected readonly rows = computed(() =>
    this.entries().map((e) => ({
      when: formatTimestamp(e.occurredAtUtc),
      who: e.actorName,
      what: e.summary,
    })),
  );
  protected readonly hasMore = computed(() => this.entries().length < this.total());
  protected readonly noResultsHeading = computed(() => {
    const label = CATEGORIES.find((c) => c.value === this.selected())?.label ?? '';
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
    this.loadingMore.set(true);
    try {
      const next = this.page() + 1;
      const result = await firstValueFrom(this.audit.getEntries(this.filters(), next));
      this.entries.update((entries) => [...entries, ...result.items]);
      this.total.set(result.totalCount);
      this.page.set(next);
    } catch {
      this.state.set('error');
    } finally {
      this.loadingMore.set(false);
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
    this.state.set('loading');
    try {
      const result = await firstValueFrom(this.audit.getEntries(this.filters(), 1));
      this.entries.set(result.items);
      this.total.set(result.totalCount);
      this.page.set(1);
      this.state.set('loaded');
    } catch (error) {
      const forbidden = error instanceof HttpErrorResponse && error.status === 403;
      this.state.set(forbidden ? 'forbidden' : 'error');
    }
  }
}
