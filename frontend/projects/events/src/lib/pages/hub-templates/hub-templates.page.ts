import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AUTH_SERVICE,
  HUB_TEMPLATES_SERVICE,
  HubTemplateSummaryDto,
  hasAny,
} from '@faithtech-community/api';
import {
  AlertComponent,
  ButtonComponent,
  ChipComponent,
  ChipGroupComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  ListComponent,
  ListItemComponent,
  MenuComponent,
  MenuEntry,
  SkeletonComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  ArchiveHubTemplateData,
  ArchiveHubTemplateDialog,
  HubTemplateNameData,
  HubTemplateNameDialog,
} from '../../dialogs';

type State = 'loading' | 'loaded' | 'error';
type Filter = 'active' | 'archived';

const sections = (n: number) => `${n} ${n === 1 ? 'section' : 'sections'} shown`;
const hubs = (n: number) =>
  n === 0 ? 'No hubs yet' : `${n} ${n === 1 ? 'hub' : 'hubs'} started from it`;

/**
 * The Hub templates tab at /organisation/hub-templates (L2-184 AC1 to AC5, L2-185), matching
 * docs/mocks/pages/organisation-hub-templates: the organisation's templates in wizard order with how many sections each
 * shows and how many hubs were started from it; add, rename and archive for holders of ManageOrganisationSettings,
 * read-only with ManageRoles, and an Archived filter with Restore. The app shell mounts it under the Organisation
 * section's tabs (ADR 0043).
 */
@Component({
  selector: 'ft-hub-templates-page',
  imports: [
    AlertComponent,
    ButtonComponent,
    ChipComponent,
    ChipGroupComponent,
    ClusterComponent,
    EmptyStateComponent,
    IconComponent,
    ListComponent,
    ListItemComponent,
    MenuComponent,
    SkeletonComponent,
    StackComponent,
  ],
  providers: [DatePipe],
  templateUrl: './hub-templates.page.html',
  styleUrl: './hub-templates.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubTemplatesPage {
  private readonly templatesService = inject(HUB_TEMPLATES_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly dates = inject(DatePipe);

  protected readonly state = signal<State>('loading');
  protected readonly filter = signal<Filter>('active');
  protected readonly templates = signal<HubTemplateSummaryDto[]>([]);
  protected readonly canEdit = computed(() =>
    hasAny(this.auth.capabilities(), 'ManageOrganisationSettings'),
  );

  protected readonly menu: MenuEntry[] = [
    { kind: 'item', id: 'rename', label: 'Rename' },
    { kind: 'divider' },
    { kind: 'item', id: 'archive', label: 'Archive', danger: true },
  ];

  constructor() {
    void this.load();
  }

  protected meta(t: HubTemplateSummaryDto): string {
    return `${sections(t.shown.length)} · ${hubs(t.hubCount)}`;
  }

  protected archivedMeta(t: HubTemplateSummaryDto): string {
    const on = t.archivedAtUtc
      ? `Archived ${this.dates.transform(t.archivedAtUtc, 'EEE d MMM')}`
      : 'Archived';
    return `${on} · ${hubs(t.hubCount)}`;
  }

  protected show(filter: Filter): void {
    if (this.filter() === filter) return;
    this.filter.set(filter);
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected act(t: HubTemplateSummaryDto, action: string): void {
    if (action === 'rename') this.rename(t);
    if (action === 'archive') this.archive(t);
  }

  protected add(): void {
    const data: HubTemplateNameData = {
      save: (name, description) => this.templatesService.add(name, description),
    };
    this.dialogs
      .open<HubTemplateSummaryDto>(HubTemplateNameDialog, { data })
      .closed.subscribe((added) => {
        if (!added) return;
        this.toasts.show({
          variant: 'success',
          heading: `${added.name} added`,
          text: 'It’s the last template when someone creates a hub. Open it to choose its sections.',
        });
        void this.load();
      });
  }

  protected async restore(t: HubTemplateSummaryDto): Promise<void> {
    try {
      await firstValueFrom(this.templatesService.restore(t.id));
      this.toasts.show({
        variant: 'success',
        heading: `${t.name} restored`,
        text: 'It’s offered again, at the end of the list.',
      });
    } catch (error) {
      const detail = (error as { status?: number; error?: { detail?: string } }).error?.detail;
      this.toasts.show({
        variant: 'danger',
        heading: `${t.name} not restored`,
        text: detail ?? 'Check your connection and try again.',
      });
    }
    void this.load();
  }

  private rename(t: HubTemplateSummaryDto): void {
    const data: HubTemplateNameData = {
      template: t,
      save: (name, description) => this.templatesService.rename(t.id, name, description),
    };
    this.dialogs
      .open<HubTemplateSummaryDto>(HubTemplateNameDialog, { data })
      .closed.subscribe((renamed) => {
        if (!renamed) return;
        this.toasts.show({
          variant: 'success',
          heading: `Renamed to ${renamed.name}`,
          text: 'Leads see the new name when they create a hub.',
        });
        void this.load();
      });
  }

  private archive(t: HubTemplateSummaryDto): void {
    const data: ArchiveHubTemplateData = {
      name: t.name,
      hubCount: t.hubCount,
      archive: () => this.templatesService.archive(t.id),
    };
    this.dialogs.open<boolean>(ArchiveHubTemplateDialog, { data }).closed.subscribe((done) => {
      if (!done) return;
      this.toasts.show({
        variant: 'success',
        heading: `${t.name} archived`,
        text: 'It’s no longer offered for new hubs. Hubs started from it keep what they have.',
      });
      void this.load();
    });
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.templates.set(
        await firstValueFrom(this.templatesService.list(this.filter() === 'archived')),
      );
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
