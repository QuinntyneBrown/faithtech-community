import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AUTH_SERVICE,
  ChapterDto,
  ChapterLabel,
  ORGANISATION_SERVICE,
  OrganisationNames,
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
  LinkComponent,
  ListComponent,
  ListItemComponent,
  ReorderableActionsDirective,
  ReorderableItem,
  ReorderableListComponent,
  SkeletonComponent,
  StackComponent,
  ToastService,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  ArchiveChapterData,
  ArchiveChapterDialog,
  ChapterNameData,
  ChapterNameDialog,
} from '../../dialogs';

type State = 'loading' | 'loaded' | 'error';
type Filter = 'active' | 'archived';

/**
 * The Chapters tab, labelled with the plural label (L2-140 AC3, L2-147 AC1), matching docs/mocks/pages/
 * organisation-chapters: the active chapters in order with their member counts, add, rename, reorder by drag and by
 * keyboard, archive and an Archived filter. Holders of ManageOrganisationSettings change them; a holder of only
 * ManageRoles reads them (L2-147 AC2). With chapters off it points to General.
 */
@Component({
  selector: 'ft-chapters-page',
  imports: [
    AlertComponent,
    ButtonComponent,
    ChipComponent,
    ChipGroupComponent,
    ClusterComponent,
    EmptyStateComponent,
    LinkComponent,
    ListComponent,
    ListItemComponent,
    ReorderableActionsDirective,
    ReorderableListComponent,
    SkeletonComponent,
    StackComponent,
  ],
  templateUrl: './chapters.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChaptersPage {
  private readonly organisations = inject(ORGANISATION_SERVICE);
  private readonly auth = inject(AUTH_SERVICE);
  private readonly names = inject(OrganisationNames);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<State>('loading');
  protected readonly filter = signal<Filter>('active');
  protected readonly label = signal<ChapterLabel | null>(null);
  protected readonly chapters = signal<ChapterDto[]>([]);
  protected readonly canEdit = computed(() =>
    hasAny(this.auth.capabilities(), 'ManageOrganisationSettings'),
  );
  protected readonly singular = computed(() => this.label()?.singular.toLowerCase() ?? '');
  protected readonly plural = computed(() => this.label()?.plural.toLowerCase() ?? '');
  protected readonly rows = computed<ReorderableItem[]>(() =>
    this.chapters().map((c) => ({ id: c.id, title: c.name, meta: members(c.memberCount) })),
  );

  constructor() {
    void this.load();
  }

  protected show(filter: Filter): void {
    if (this.filter() === filter) return;
    this.filter.set(filter);
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected meta(c: ChapterDto): string {
    return members(c.memberCount);
  }

  protected add(): void {
    const label = this.label();
    if (!label) return;
    const data: ChapterNameData = { label };
    this.dialogs.open<ChapterDto>(ChapterNameDialog, { data }).closed.subscribe((added) => {
      if (!added) return;
      this.toasts.show({
        variant: 'success',
        heading: `${added.name} added`,
        text: `It’s now in every ${this.singular()} picker and filter.`,
      });
      void this.load();
    });
  }

  protected rename(item: ReorderableItem): void {
    const label = this.label();
    if (!label) return;
    const data: ChapterNameData = { label, chapter: { id: item.id, name: item.title } };
    this.dialogs.open<ChapterDto>(ChapterNameDialog, { data }).closed.subscribe((renamed) => {
      if (!renamed) return;
      this.toasts.show({
        variant: 'success',
        heading: `Renamed to ${renamed.name}`,
        text: 'Members, events and roles tagged with it show the new name.',
      });
      void this.load();
    });
  }

  protected archive(item: ReorderableItem): void {
    const label = this.label();
    const chapter = this.chapters().find((c) => c.id === item.id);
    if (!label || !chapter) return;
    const data: ArchiveChapterData = { label, chapter };
    this.dialogs.open<boolean>(ArchiveChapterDialog, { data }).closed.subscribe((done) => {
      if (!done) return;
      this.toasts.show({
        variant: 'success',
        heading: `${chapter.name} archived`,
        text: 'It’s listed under Archived. Members and events keep it.',
      });
      void this.load();
    });
  }

  /** Saved after each move; a failed save puts the order back (docs/design-system/components/reorderable-list). */
  protected async reorder(ids: string[]): Promise<void> {
    try {
      this.chapters.set(await firstValueFrom(this.organisations.reorderChapters(ids)));
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'Order not saved',
        text: this.names.unreachable('The order is as it was.'),
      });
      void this.load();
    }
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const organisation = await firstValueFrom(this.organisations.get());
      this.label.set(organisation.chapterLabel);
      this.chapters.set(
        organisation.chapterLabel
          ? await firstValueFrom(this.organisations.listChapters(this.filter() === 'archived'))
          : [],
      );
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}

function members(count: number): string {
  return count === 1 ? '1 member' : `${count} members`;
}
