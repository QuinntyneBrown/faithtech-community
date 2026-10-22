import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NOTES_SERVICE, NoteBlock, NotePageDto } from '@faithtech-community/api';
import {
  BlockEditorComponent,
  BlockRequest,
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  DialogService,
  EditorBlock,
  EmptyStateComponent,
  IconComponent,
  PageTitleComponent,
  SaveStatusComponent,
  SkeletonComponent,
  ToastService,
  newBlockId,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { AddLinkCardDialog, LinkCard } from '../../dialogs';
import { NoteAutosave } from '../../note-autosave';
import { titleOf } from '../../note-format';

type State = 'loading' | 'loaded' | 'missing' | 'error';

/** One page at /notes/{id}: the editor for its owner, read-only for everyone else (L2-086, L2-092). */
@Component({
  selector: 'ft-note-page',
  imports: [
    BlockEditorComponent,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    PageTitleComponent,
    SaveStatusComponent,
    SkeletonComponent,
  ],
  templateUrl: './note.page.html',
  styleUrl: './note.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotePage {
  private readonly notes = inject(NOTES_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
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
  protected autosave: NoteAutosave | null = null;
  private blocks: NoteBlock[] = [];
  private id = '';

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => {
        this.id = params.get('id') ?? '';
        void this.load(true);
      });
    inject(DestroyRef).onDestroy(() => this.autosave?.cancel());
  }

  protected retry(): void {
    void this.load(false);
  }

  protected onTitle(value: string): void {
    this.title.set(value);
    this.autosave?.changed();
  }

  protected onBlocks(blocks: EditorBlock[]): void {
    this.blocks = blocks as NoteBlock[];
    this.autosave?.changed();
  }

  protected toFirstBlock(): void {
    this.editor()?.focusFirst();
  }

  /** A link card or image the editor asked for, filled in through its dialog. */
  protected request(request: BlockRequest): void {
    if (request.type !== 'link') return;
    this.dialogs.open<LinkCard>(AddLinkCardDialog).closed.subscribe((card) => {
      if (card) this.editor()?.place(request, { id: newBlockId(), type: 'link', ...card });
    });
  }

  protected refused(message: string): void {
    this.toasts.show({ variant: 'warning', heading: 'Block not added', text: message });
  }

  private async load(focusTitle: boolean): Promise<void> {
    this.state.set('loading');
    this.autosave?.cancel();
    try {
      const page = await firstValueFrom(this.notes.get(this.id));
      this.page.set(page);
      this.title.set(page.title);
      this.icon.set(page.icon);
      this.blocks = page.blocks;
      this.loadedBlocks.set(page.blocks);
      this.autosave = new NoteAutosave(
        page.version,
        () => ({ title: this.title(), icon: this.icon(), blocks: this.blocks }),
        (save) => this.notes.save(this.id, save),
      );
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
