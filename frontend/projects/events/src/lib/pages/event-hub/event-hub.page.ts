import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  EVENT_HUBS_SERVICE,
  EventHubDto,
  HubSectionKind,
  HubSectionState,
} from '@faithtech-community/api';
import {
  ClusterComponent,
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
  formatTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  MoveHubSessionData,
  MoveHubSessionDialog,
  MovedSession,
  PostHubUpdateData,
  SwapHubLinkData,
  SwapHubLinkDialog,
  PostHubUpdateDialog,
  HubSectionPreviewData,
  HubSectionPreviewDialog,
  PREVIEWABLE,
  ReorderHubSectionsData,
  ReorderHubSectionsDialog,
  ShareHubData,
  ShareHubDialog,
  UnpublishHubData,
  UnpublishHubDialog,
} from '../../dialogs';
import { fileSlug, saveFile } from '../../download';
import { HubSectionWizardData, hubSection, sectionContent } from '../../hub-sections';
import { HUB_WIZARDS as WIZARDS, WIDE_HUB_WIZARDS as WIDE } from '../hub-wizards';

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
    ClusterComponent,
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
  protected readonly publishing = signal(false);
  protected readonly archiving = signal(false);
  protected readonly clearing = signal(false);
  /** Move a session is offered only when the Agenda is shown and has rows (L2-188 AC3). */
  protected readonly agendaRows = computed(() => {
    const hub = this.hub();
    const shown = hub?.sections.some((s) => s.kind === 'Agenda' && s.visible);
    return shown ? (sectionContent(hub!, 'Agenda')?.items?.length ?? 0) : 0;
  });

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

  /** Post an update, or change the live one (L2-189 AC1 to AC3); the hub shows it at once. */
  protected async postUpdate(): Promise<void> {
    const ref = this.dialogs.open<boolean, PostHubUpdateData>(PostHubUpdateDialog, {
      data: { eventId: this.id(), current: this.hub()?.updateBanner },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({
      variant: 'success',
      heading: 'Update posted',
      text: 'It shows at the top of the hub now.',
    });
    await this.load(this.id(), true);
  }

  /** Swap a link is offered only while Submission and feedback is shown (L2-188 AC3). */
  protected readonly linksShown = computed(
    () => !!this.hub()?.sections.some((s) => s.kind === 'Links' && s.visible),
  );

  /** Swap a link (L2-191): saves the Submission and feedback section with the other link unchanged. */
  protected async swapLink(): Promise<void> {
    const hub = this.hub();
    if (!hub) return;
    const ref = this.dialogs.open<'submission' | 'feedback', SwapHubLinkData>(SwapHubLinkDialog, {
      data: { hub },
    });
    const which = await firstValueFrom(ref.closed);
    if (!which) return;
    this.toasts.show({
      variant: 'success',
      heading: 'Link swapped',
      text: `The ${which === 'submission' ? 'Submission' : 'Feedback'} link changed on the hub.`,
    });
    await this.load(this.id(), true);
  }

  /** Move a session (L2-190): one dialog; the server moves the later rows when asked. */
  protected async moveSession(): Promise<void> {
    const hub = this.hub();
    if (!hub) return;
    const ref = this.dialogs.open<MovedSession, MoveHubSessionData>(MoveHubSessionDialog, {
      data: { hub },
    });
    const moved = await firstValueFrom(ref.closed);
    if (!moved) return;
    const later = moved.later
      ? `, and ${moved.later === 1 ? 'the later session' : `the ${moved.later} later sessions`} moved too`
      : '';
    this.toasts.show({
      variant: 'success',
      heading: 'Session moved',
      text: `${moved.title} is now ${formatTime(moved.startsAt)}${later}.`,
    });
    await this.load(this.id(), true);
  }

  /** Clear update (L2-189 AC4): one tap, no confirmation; a failure offers Try again on its toast. */
  protected async clearUpdate(): Promise<void> {
    if (this.clearing()) return;
    this.clearing.set(true);
    try {
      await firstValueFrom(this.hubs.clearUpdate(this.id()));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t clear the update',
        text: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () => void this.clearUpdate(),
      });
      return;
    } finally {
      this.clearing.set(false);
    }
    this.toasts.show({
      variant: 'success',
      heading: 'Update cleared',
      text: 'The hub no longer shows it.',
    });
    await this.load(this.id(), true);
  }

  /** "Sun 1 Nov · 3:40 pm": when the hub was published (L2-164 AC2). */
  protected when(at: string): string {
    return `${formatDay(at)} · ${formatTime(at)}`;
  }

  /** Copy link (L2-165 AC1): the copy field copies, or selects the link when the browser refuses. */
  protected linkCopied(): void {
    this.toasts.show({
      variant: 'success',
      heading: 'Link copied',
      text: 'Share it with attendees and helpers.',
    });
  }

  /** Publish (L2-164 AC1): refuses nothing; a failure offers Try again on its toast. */
  protected async publish(): Promise<void> {
    if (this.publishing()) return;
    this.publishing.set(true);
    try {
      await firstValueFrom(this.hubs.publish(this.id()));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t publish the hub',
        text: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () => void this.publish(),
      });
      return;
    } finally {
      this.publishing.set(false);
    }
    this.toasts.show({
      variant: 'success',
      heading: 'Hub published',
      text: 'Visitors can open it now.',
    });
    await this.load(this.id(), true);
  }

  /** Share (L2-193 AC1): the hub's QR code and link, drawn from what the page already loaded. */
  protected share(hub: EventHubDto): void {
    this.dialogs.open<void, ShareHubData>(ShareHubDialog, {
      data: { eventTitle: hub.event.title, link: hub.link, status: hub.status },
    });
  }

  /** Download archive (L2-196): the hub as a zip, its times in the browser's time zone; a failure offers Try again. */
  protected async downloadArchive(hub: EventHubDto): Promise<void> {
    if (this.archiving()) return;
    this.archiving.set(true);
    const fileName = `${fileSlug(hub.event.title)}-hub.zip`;
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      saveFile(await firstValueFrom(this.hubs.archive(this.id(), timeZone)), fileName);
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t make the archive',
        text: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: () => void this.downloadArchive(hub),
      });
      return;
    } finally {
      this.archiving.set(false);
    }
    this.toasts.show({
      variant: 'success',
      heading: 'Archive downloaded',
      text: `${fileName} is in your downloads.`,
    });
  }

  /** Unpublish (L2-164 AC3): asks first in its dialog. */
  protected async unpublish(): Promise<void> {
    const ref = this.dialogs.open<boolean, UnpublishHubData>(UnpublishHubDialog, {
      data: { eventId: this.id() },
    });
    if (!(await firstValueFrom(ref.closed))) return;
    this.toasts.show({
      variant: 'success',
      heading: 'Hub unpublished',
      text: 'It’s a draft again, so only people who manage hubs can open it.',
    });
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
