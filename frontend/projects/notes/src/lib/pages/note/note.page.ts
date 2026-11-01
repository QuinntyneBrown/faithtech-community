import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NoteBlock,
  NoteConflict,
  NotePageDto,
  NotePageRef,
  NOTES_SERVICE,
  OrganisationNames,
  OrganisationRoles,
} from '@faithtech-community/api';
import {
  BannerComponent,
  BlockEditorComponent,
  BlockRequest,
  LinkRequest,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  DialogService,
  EditorBlock,
  EmptyStateComponent,
  EditorSpan,
  IconComponent,
  MenuComponent,
  MenuEntry,
  PageLinkItem,
  PageLinkView,
  PageLinksComponent,
  PageTitleComponent,
  SaveStatusComponent,
  SkeletonComponent,
  ToastService,
  formatDay,
  formatTime,
  newBlockId,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import {
  AddLinkCardDialog,
  AddLinkDialog,
  LinkCard,
  LinkChoice,
  AddImageDialog,
  AddedImage,
  ArchiveNoteDialog,
  ChangeIconDialog,
  EditAltTextDialog,
  MoveNoteDialog,
  NoteSettingsDialog,
  PageSettings,
  RestoreNoteDialog,
  MoveResult,
  ShareNoteDialog,
} from '../../dialogs';
import { NoteAutosave } from '../../note-autosave';
import { createRefusal } from '../../note-errors';
import { titleOf } from '../../note-format';

type State = 'loading' | 'loaded' | 'missing' | 'error';

/** One page at /notes/{id}: the editor for its owner, read-only for everyone else (L2-086, L2-092). */
@Component({
  selector: 'ft-note-page',
  imports: [
    BannerComponent,
    BlockEditorComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    MenuComponent,
    PageLinksComponent,
    PageTitleComponent,
    SaveStatusComponent,
    SkeletonComponent,
  ],
  templateUrl: './note.page.html',
  styleUrl: './note.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotePage {
  private readonly organisationRoles = inject(OrganisationRoles);
  protected readonly organisation = inject(OrganisationNames);
  private readonly notes = inject(NOTES_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  private readonly titleBox = viewChild(PageTitleComponent);
  private readonly editor = viewChild(BlockEditorComponent);

  protected readonly state = signal<State>('loading');
  protected readonly page = signal<NotePageDto | null>(null);
  protected readonly title = signal('');
  protected readonly icon = signal<string | null>(null);
  /** The blocks as loaded; the editor keeps its own working copy. */
  protected readonly loadedBlocks = signal<NoteBlock[]>([]);
  protected readonly editable = computed(() => !!this.page()?.canEdit && !this.page()?.archivedAt);
  protected readonly titleOf = titleOf;
  protected readonly formatDay = formatDay;
  protected readonly autosave = signal<NoteAutosave | null>(null);
  /** Autosave stopped on a 409, 403 or 404: editing pauses and the page says why (L2-094). */
  protected readonly stop = computed(() => this.autosave()?.stopped() ?? null);
  /** The blocks as last edited, shown read-only while editing is paused. */
  private readonly latest = signal<NoteBlock[]>([]);
  protected readonly editorBlocks = computed(() =>
    this.stop() ? this.latest() : this.loadedBlocks(),
  );
  protected readonly conflictText = computed(() => {
    const stop = this.stop();
    if (stop?.kind !== 'conflict') return '';
    const body = stop.body as Partial<NoteConflict> | null;
    const who = body?.updatedByYou ? 'You' : (body?.updatedByName ?? 'Someone');
    const at = body?.updatedAt ? ` at ${formatTime(body.updatedAt)}` : '';
    return `${who} saved a newer version${at}. Your last changes weren’t saved.`;
  });
  protected readonly creating = signal(false);
  protected readonly actions = computed<MenuEntry[]>(() => [
    { kind: 'item', id: 'settings', label: 'Page settings', icon: 'settings' },
    { kind: 'item', id: 'inside', label: 'New page inside', icon: 'add' },
    { kind: 'item', id: 'move', label: 'Move', icon: 'move' },
    { kind: 'divider' },
    { kind: 'item', id: 'archive', label: 'Archive', icon: 'archive' },
  ]);
  /** What a recipient of a Shared page is told (L2-092 AC7). */
  protected readonly sharedBanner = computed(() => {
    const p = this.page();
    if (!p?.sharedVia) return null;
    const via =
      p.sharedVia === 'you'
        ? 'you'
        : `everyone who has the ${this.organisationRoles.label(p.sharedVia)} role`;
    return `${p.ownerName} shared this with ${via}. You can read it, but only ${p.ownerName} can change it.`;
  });
  /** Pages the viewer may open by id: the API's link targets plus every "[[" suggestion seen since. */
  private readonly known = new Map<string, NotePageRef>();
  /** How a page link shows: the target's title and icon, or "Private page" (L2-090 AC2, AC3). */
  protected readonly pageLink = (span: EditorSpan): PageLinkView => {
    const target = span.pageId ? this.known.get(span.pageId) : undefined;
    return target
      ? { text: target.title, icon: target.icon, href: `/notes/${target.id}` }
      : { text: 'Private page', icon: null, href: null };
  };
  /** Images are fetched with the member's token and shown from object URLs (ADR 0017's pattern). */
  private readonly imageUrls: string[] = [];
  protected readonly imageSrc = async (imageId: string): Promise<string> => {
    const url = URL.createObjectURL(await firstValueFrom(this.notes.image(this.id, imageId)));
    this.imageUrls.push(url);
    return url;
  };
  protected readonly pageSearch = async (q: string): Promise<PageLinkItem[]> => {
    const found = await firstValueFrom(this.notes.linkSuggestions(q, this.id));
    found.forEach((f) => f.id && this.known.set(f.id, f));
    return found;
  };
  private blocks: NoteBlock[] = [];
  private id = '';

  constructor() {
    // A page archived or hidden while it is edited is no longer available (L2-094 AC7).
    effect(() => {
      if (this.stop()?.kind === 'missing') this.state.set('missing');
    });
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => {
        this.id = params.get('id') ?? '';
        void this.load(true);
      });
    // Changes not yet saved go out when the page is left inside the app, and leaving the tab asks first.
    const guard = (event: BeforeUnloadEvent) => {
      if (this.autosave()?.pending()) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeunload', guard);
      this.autosave()?.flush();
      this.imageUrls.forEach((url) => URL.revokeObjectURL(url));
    });
  }

  /** "Reload page" after a conflict or an access change (L2-094 AC4, AC6). */
  protected reload(): void {
    void this.load(false);
  }

  protected retry(): void {
    void this.load(false);
  }

  protected onTitle(value: string): void {
    this.title.set(value);
    this.autosave()?.changed();
  }

  protected onBlocks(blocks: EditorBlock[]): void {
    this.blocks = blocks as NoteBlock[];
    this.latest.set(this.blocks);
    this.autosave()?.changed();
  }

  protected toFirstBlock(): void {
    this.editor()?.focusFirst();
  }

  /** A link card or image the editor asked for, filled in through its dialog. */
  protected request(request: BlockRequest): void {
    if (request.type === 'image') {
      this.dialogs.open<AddedImage>(AddImageDialog, { data: this.id }).closed.subscribe((image) => {
        if (image) this.editor()?.place(request, { id: newBlockId(), type: 'image', ...image });
      });
      return;
    }
    this.dialogs.open<LinkCard>(AddLinkCardDialog).closed.subscribe((card) => {
      if (card) this.editor()?.place(request, { id: newBlockId(), type: 'link', ...card });
    });
  }

  /** A hyperlink over selected text, added, changed or removed through its dialog (L2-088 AC3, AC4). */
  protected link(request: LinkRequest): void {
    this.dialogs
      .open<LinkChoice>(AddLinkDialog, { data: { href: request.href } })
      .closed.subscribe((choice) => {
        if (choice) this.editor()?.applyLink(request, choice.href);
      });
  }

  /** Who can see the page (L2-093). */
  protected share(): void {
    const page = this.page()!;
    this.dialogs
      .open<NotePageDto>(ShareNoteDialog, { data: { ...page, title: this.title() } })
      .closed.subscribe((shared) => {
        if (!shared) return;
        this.page.set({ ...page, visibility: shared.visibility, audience: shared.audience });
        this.toasts.show({
          variant: 'success',
          heading: `Sharing updated for ${titleOf({ title: this.title() })}`,
          text:
            shared.visibility === 'Private'
              ? 'Only you can see it now.'
              : shared.visibility === 'Global'
                ? 'Every signed-in member can find it now.'
                : 'The people you chose can read it now.',
        });
      });
  }

  protected act(id: string): void {
    if (id === 'settings') this.settings();
    if (id === 'inside') void this.newPageInside();
    if (id === 'move') this.move();
    if (id === 'archive') this.archive();
  }

  /** Archives the page and goes back to Notes, with Undo (L2-095 AC1). */
  protected archive(): void {
    const title = titleOf({ title: this.title() });
    this.dialogs
      .open<boolean>(ArchiveNoteDialog, { data: { id: this.id, title } })
      .closed.subscribe((archived) => {
        if (!archived) return;
        const id = this.id;
        this.autosave()?.cancel();
        void this.router.navigate(['/notes']);
        this.toasts.show({
          variant: 'info',
          heading: `${title} archived`,
          text: 'Restore it from Archived.',
          actionLabel: 'Undo',
          onAction: () => void this.undoArchive(id, title),
        });
      });
  }

  private async undoArchive(id: string, title: string): Promise<void> {
    try {
      await firstValueFrom(this.notes.restore(id));
      await this.router.navigate(['/notes', id]);
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: `${title} wasn’t restored`,
        text: `We couldn’t reach ${this.organisation.shortName()}. It’s still archived.`,
      });
    }
  }

  /** Restores an archived page from its banner (L2-095 AC6). */
  protected restore(): void {
    this.dialogs
      .open<boolean>(RestoreNoteDialog, {
        data: { id: this.id, title: titleOf({ title: this.title() }) },
      })
      .closed.subscribe((restored) => {
        if (!restored) return;
        this.toasts.show({
          variant: 'success',
          heading: `${titleOf({ title: this.title() })} restored`,
          text: 'It’s back in Notes, with the same visibility as before.',
        });
        void this.load(false);
      });
  }

  /** The title and icon, saved through autosave (L2-086 AC3). */
  protected settings(): void {
    this.dialogs
      .open<PageSettings>(NoteSettingsDialog, { data: { title: this.title(), icon: this.icon() } })
      .closed.subscribe((settings) => {
        if (!settings) return;
        this.title.set(settings.title);
        this.icon.set(settings.icon);
        this.autosave()?.changed();
      });
  }

  /** A callout's Change icon from its block menu (L2-087 AC6). */
  protected editBlock({ index, block }: { index: number; block: EditorBlock }): void {
    if (block.type === 'image') {
      this.dialogs
        .open<string>(EditAltTextDialog, { data: block.alt ?? '' })
        .closed.subscribe((alt) => {
          if (alt) this.editor()?.update(index, { ...block, alt });
        });
      return;
    }
    if (block.type !== 'callout') return;
    this.dialogs
      .open<string>(ChangeIconDialog, { data: block.icon ?? '💡' })
      .closed.subscribe((icon) => {
        if (icon) this.editor()?.update(index, { ...block, icon });
      });
  }

  /** Creates a page inside this one and opens it (L2-085 AC7). */
  protected async newPageInside(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      const child = await firstValueFrom(this.notes.create(null, this.id));
      await this.router.navigate(['/notes', child.id]);
    } catch (error) {
      this.toasts.show({
        variant: 'danger',
        heading: 'Page not created',
        text: createRefusal(error, this.organisation.shortName()),
      });
    } finally {
      this.creating.set(false);
    }
  }

  /** Moves the page under another of the owner's pages, or to the top level (L2-091 AC3, AC4). */
  protected move(): void {
    const page = this.page()!;
    this.dialogs
      .open<MoveResult>(MoveNoteDialog, { data: { ...page, title: this.title() } })
      .closed.subscribe((moved) => {
        if (!moved) return;
        this.page.set({
          ...page,
          parentId: moved.page.parentId,
          breadcrumb: moved.page.breadcrumb,
        });
        this.toasts.show({
          variant: 'success',
          heading: `${titleOf({ title: this.title() })} moved`,
          text: moved.parentTitle
            ? `It’s now inside ${moved.parentTitle}.`
            : 'It’s now at the top level.',
        });
      });
  }

  protected refused(message: string): void {
    this.toasts.show({ variant: 'warning', heading: 'Block not added', text: message });
  }

  private async load(focusTitle: boolean): Promise<void> {
    this.state.set('loading');
    this.autosave()?.cancel();
    try {
      const page = await firstValueFrom(this.notes.get(this.id));
      this.known.clear();
      page.links.forEach((l) => l.id && this.known.set(l.id, l));
      this.page.set(page);
      this.title.set(page.title);
      this.icon.set(page.icon);
      this.blocks = page.blocks;
      this.loadedBlocks.set(page.blocks);
      this.latest.set(page.blocks);
      const autosave = new NoteAutosave(
        page.version,
        () => ({ title: this.title(), icon: this.icon(), blocks: this.blocks }),
        (save) => this.notes.save(this.id, save),
      );
      this.autosave.set(autosave);
      this.state.set('loaded');
      if (focusTitle && page.canEdit && !page.title) {
        setTimeout(() => this.titleBox()?.focus());
      }
    } catch (error) {
      this.state.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'missing' : 'error',
      );
    }
  }
}
