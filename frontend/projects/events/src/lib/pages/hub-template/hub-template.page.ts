import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  AUTH_SERVICE,
  HUB_TEMPLATES_SERVICE,
  HubContentInputByKind,
  HubSectionKind,
  HubTemplateDefaultInput,
  HubTemplateDetailDto,
  HubTemplateSummaryDto,
  hasAny,
} from '@faithtech-community/api';
import {
  AlertComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  LinkComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  HubTemplateNameData,
  HubTemplateNameDialog,
  HubTemplateSectionsData,
  HubTemplateSectionsDialog,
} from '../../dialogs';
import { HUB_SECTIONS, HubSectionWizardData } from '../../hub-sections';
import { HUB_WIZARDS, WIDE_HUB_WIZARDS } from '../hub-wizards';
import { WITH_DEFAULTS, defaultSummary, standInHub, toTemplateContent } from './template-defaults';

type State = 'loading' | 'loaded' | 'error' | 'not-found';

/**
 * One hub template at /organisation/hub-templates/{id} (L2-186, L2-187), matching docs/mocks/pages/organisation-hub-template:
 * every section in catalogue order with whether new hubs show it and what text they get; Rename, Choose sections and
 * Edit default text, which opens the hub's own wizard on a stand-in hub and saves to the template (ADR 0043). Read-only
 * with ManageRoles, and for an archived template, which offers Restore.
 */
@Component({
  selector: 'ft-hub-template-page',
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ClusterComponent,
    EmptyStateComponent,
    IconComponent,
    LinkComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    StackComponent,
  ],
  templateUrl: './hub-template.page.html',
  styleUrl: './hub-template.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubTemplatePage {
  readonly id = input.required<string>();

  private readonly templates = inject(HUB_TEMPLATES_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<State>('loading');
  protected readonly template = signal<HubTemplateDetailDto | null>(null);
  protected readonly canManage = computed(() =>
    hasAny(this.auth.capabilities(), 'ManageOrganisationSettings'),
  );
  /** Changes need the capability and an active template (L2-185 AC4). */
  protected readonly canEdit = computed(() => this.canManage() && !this.template()?.archived);

  protected readonly rows = computed(() => {
    const t = this.template();
    if (!t) return [];
    return HUB_SECTIONS.map((s) => {
      const held = t.sections.find((x) => x.kind === s.kind);
      return {
        kind: s.kind,
        title: s.title,
        line: s.line,
        visible: held?.visible ?? false,
        summary: defaultSummary(s.kind, held?.content ?? null),
        editable: WITH_DEFAULTS.includes(s.kind) && !!HUB_WIZARDS[s.kind],
      };
    });
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => void this.load());
    });
  }

  protected retry(): void {
    void this.load();
  }

  protected rename(): void {
    const t = this.template();
    if (!t) return;
    const data: HubTemplateNameData = {
      template: t,
      save: (name, description) => this.templates.rename(t.id, name, description),
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

  protected chooseSections(): void {
    const t = this.template();
    if (!t) return;
    const data: HubTemplateSectionsData = {
      name: t.name,
      shown: t.sections.filter((s) => s.visible).map((s) => s.kind),
      save: (shown) => this.templates.setSections(t.id, shown),
    };
    this.dialogs
      .open<HubTemplateDetailDto>(HubTemplateSectionsDialog, { data }, { wide: true })
      .closed.subscribe((saved) => {
        if (!saved) return;
        this.template.set(saved);
        const shown = saved.sections.filter((s) => s.visible).length;
        this.toasts.show({
          variant: 'success',
          heading: 'Sections saved',
          text: `New hubs started from ${saved.name} show ${shown} ${shown === 1 ? 'section' : 'sections'}.`,
        });
      });
  }

  /** Opens the hub's wizard for the section on a stand-in hub; it saves to the template (L2-186 AC3, AC4). */
  protected async editDefault(kind: HubSectionKind): Promise<void> {
    const t = this.template();
    const wizard = HUB_WIZARDS[kind];
    if (!t || !wizard) return;
    const { hub, start } = standInHub(t);
    const data: HubSectionWizardData = {
      hub,
      template: {
        name: t.name,
        save: <K extends HubSectionKind>(k: K, content: HubContentInputByKind[K]) =>
          this.templates.saveDefault(
            t.id,
            k,
            toTemplateContent(k, content, start) as HubTemplateDefaultInput<K>,
          ),
      },
    };
    const ref = this.dialogs.open<boolean, HubSectionWizardData>(
      wizard,
      { data },
      { wide: WIDE_HUB_WIZARDS.includes(kind) },
    );
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({
      variant: 'success',
      heading: `${HUB_SECTIONS.find((s) => s.kind === kind)?.title ?? kind} saved`,
      text: `New hubs started from ${t.name} will use it.`,
    });
    void this.load(false);
  }

  protected async restore(): Promise<void> {
    const t = this.template();
    if (!t) return;
    try {
      await firstValueFrom(this.templates.restore(t.id));
      this.toasts.show({
        variant: 'success',
        heading: `${t.name} restored`,
        text: 'It’s offered again, at the end of the list.',
      });
      void this.load(false);
    } catch (error) {
      const detail =
        error instanceof HttpErrorResponse
          ? (error.error?.detail as string | undefined)
          : undefined;
      this.toasts.show({
        variant: 'danger',
        heading: `${t.name} not restored`,
        text: detail ?? 'Check your connection and try again.',
      });
    }
  }

  private async load(showLoading = true): Promise<void> {
    if (showLoading) this.state.set('loading');
    try {
      this.template.set(await firstValueFrom(this.templates.get(this.id())));
      this.state.set('loaded');
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400)
          ? 'not-found'
          : 'error',
      );
    }
  }
}
