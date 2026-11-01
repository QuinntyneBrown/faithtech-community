import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  Type,
} from '@angular/core';
import {
  EVENT_HUBS_SERVICE,
  EventHubDto,
  HubSectionKind,
  HubSectionState,
} from '@faithtech-community/api';
import {
  BadgeComponent,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  ChecklistRowComponent,
  ChecklistRowState,
  CopyFieldComponent,
  DialogService,
  DescriptionListComponent,
  DescriptionListItemComponent,
  EmptyStateComponent,
  IconComponent,
  ListComponent,
  ListSkeletonComponent,
  MenuComponent,
  MenuEntry,
  PageHeaderComponent,
  ProgressComponent,
  StackComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  HubAgendaDialog,
  HubGivingDialog,
  HubHeroDialog,
  HubLinksDialog,
  HubPeopleDialog,
  HubUpcomingDialog,
  HubVenueDialog,
  HubSectionPreviewData,
  HubSectionPreviewDialog,
  PREVIEWABLE,
  ReorderHubSectionsData,
  ReorderHubSectionsDialog,
} from '../../dialogs';
import { HubSectionWizardData, hubSection } from '../../hub-sections';

type State = 'loading' | 'loaded' | 'error' | 'forbidden' | 'no-hub';

const ROW_STATES: Record<HubSectionState, ChecklistRowState> = {
  Ready: 'ready',
  NeedsInfo: 'needs-info',
  Hidden: 'hidden',
};

const BADGES = {
  Ready: { label: 'Ready', variant: 'success' },
  NeedsInfo: { label: 'Needs info', variant: 'warning' },
  Hidden: { label: 'Hidden', variant: 'neutral' },
} as const;

/** Each section's wizard (L2-157); a section joins as its wizard lands. */
const WIZARDS: Partial<Record<HubSectionKind, Type<unknown>>> = {
  Hero: HubHeroDialog,
  Agenda: HubAgendaDialog,
  Venue: HubVenueDialog,
  People: HubPeopleDialog,
  Links: HubLinksDialog,
  Giving: HubGivingDialog,
  UpcomingEvents: HubUpcomingDialog,
};

/** The two-step wizards, opened in the wide panel (docs/mocks/dialogs/hub-agenda, hub-people). */
const WIDE: readonly HubSectionKind[] = ['Agenda', 'People'];

const PREVIEW: MenuEntry = {
  kind: 'item',
  id: 'preview',
  label: 'Preview',
  icon: 'read-only-view',
};
const HIDE: MenuEntry = { kind: 'item', id: 'hide', label: 'Hide section', icon: 'hidden' };

/**
 * The hub home (L2-154, L2-156), matching docs/mocks/pages/event-hub: the hub's status and link, how many sections are
 * ready, and one checklist row per section with its actions: a shown section's More menu hides it, a hidden one offers
 * Show, and Reorder sections opens its dialog. The event's facts are read from the event through the API on every load.
 */
@Component({
  selector: 'ft-event-hub-page',
  imports: [
    BadgeComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    ChecklistRowComponent,
    CopyFieldComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    EmptyStateComponent,
    IconComponent,
    ListComponent,
    ListSkeletonComponent,
    MenuComponent,
    PageHeaderComponent,
    ProgressComponent,
    StackComponent,
  ],
  templateUrl: './event-hub.page.html',
  styleUrl: './event-hub.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventHubPage {
  private readonly hubs = inject(EVENT_HUBS_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  /** The event's id, from the route. */
  readonly id = input.required<string>();

  protected readonly state = signal<State>('loading');
  protected readonly hub = signal<EventHubDto | null>(null);

  protected readonly subtitle = computed(() => {
    const h = this.hub();
    return h ? `${h.event.title} · ${formatDay(h.event.startsAt)}` : '';
  });
  protected readonly rows = computed(() =>
    (this.hub()?.sections ?? []).map((s) => {
      const section = hubSection(s.kind);
      return {
        ...section,
        line: s.state === 'NeedsInfo' ? (section.missing ?? section.line) : section.line,
        sectionState: s.state,
        state: ROW_STATES[s.state],
        hasWizard: !!WIZARDS[s.kind],
        menu: PREVIEWABLE.includes(s.kind) ? [PREVIEW, HIDE] : [HIDE],
      };
    }),
  );
  protected readonly shown = computed(() => this.rows().filter((r) => r.state !== 'hidden').length);
  protected readonly ready = computed(() => this.rows().filter((r) => r.state === 'ready').length);
  protected readonly progress = computed(() => `${this.ready()} of ${this.shown()} sections ready`);

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected retry(): void {
    void this.load(this.id());
  }

  /** Hide section or Show (L2-156 AC3): saves the visibility only, keeping the section's content. */
  protected async setVisible(kind: HubSectionKind, visible: boolean): Promise<void> {
    const title = hubSection(kind).title;
    try {
      await firstValueFrom(
        this.hubs.save(this.id(), { templateKey: 'blank', sections: [{ kind, visible }] }),
      );
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: `We couldn’t ${visible ? 'show' : 'hide'} ${title}`,
        text: 'Check your connection and try again.',
      });
      return;
    }
    this.toasts.show({
      variant: 'success',
      heading: `${title} ${visible ? 'shown' : 'hidden'}`,
      text: visible
        ? 'Visitors will see it once you publish.'
        : 'Visitors won’t see it. What it says is kept.',
    });
    await this.load(this.id(), true);
  }

  protected act(kind: HubSectionKind, item: string): void {
    if (item === 'hide') void this.setVisible(kind, false);
    if (item === 'preview') void this.preview(kind);
  }

  /** Fill in or Edit (L2-157 AC1, AC2): the section's wizard; once saved, the toast and the new state. */
  protected async fillIn(kind: HubSectionKind): Promise<void> {
    const hub = this.hub();
    const wizard = WIZARDS[kind];
    if (!hub || !wizard) return;
    const ref = this.dialogs.open<boolean, HubSectionWizardData>(
      wizard,
      { data: { hub } },
      { wide: WIDE.includes(kind) },
    );
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({ variant: 'success', heading: `${hubSection(kind).title} saved` });
    await this.load(this.id(), true);
  }

  /** Preview (L2-156 AC5): the section as visitors will see it, with Edit. */
  private async preview(kind: HubSectionKind): Promise<void> {
    const hub = this.hub();
    if (!hub) return;
    const ref = this.dialogs.open<'edit', HubSectionPreviewData>(
      HubSectionPreviewDialog,
      { data: { hub, kind } },
      { wide: true },
    );
    if ((await firstValueFrom(ref.closed)) === 'edit') await this.fillIn(kind);
  }

  /** Reorder sections (L2-156 AC4). */
  protected async reorder(): Promise<void> {
    const ref = this.dialogs.open<boolean, ReorderHubSectionsData>(ReorderHubSectionsDialog, {
      data: {
        eventId: this.id(),
        sections: this.rows().map((r) => ({
          id: r.kind,
          title: r.title,
          badges: [BADGES[r.sectionState]],
        })),
      },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({ variant: 'success', heading: 'Sections reordered' });
    await this.load(this.id(), true);
  }

  /** Loads the hub; a refresh after a change keeps the page on screen instead of the skeleton. */
  private async load(id: string, refresh = false): Promise<void> {
    if (!refresh) this.state.set('loading');
    try {
      const hub = await firstValueFrom(this.hubs.get(id));
      if (id !== this.id()) return;
      this.hub.set(hub);
      this.state.set('loaded');
    } catch (error) {
      if (id !== this.id()) return;
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.state.set(status === 403 ? 'forbidden' : status === 404 ? 'no-hub' : 'error');
    }
  }
}
