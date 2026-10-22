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
import { NOTES_SERVICE, NotePageDto } from '@faithtech-community/api';
import {
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  EmptyStateComponent,
  IconComponent,
  PageTitleComponent,
  SkeletonComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { titleOf } from '../../note-format';

type State = 'loading' | 'loaded' | 'missing' | 'error';

/** One page at /notes/{id}: the editor for its owner, read-only for everyone else (L2-086, L2-092). */
@Component({
  selector: 'ft-note-page',
  imports: [
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    PageTitleComponent,
    SkeletonComponent,
  ],
  templateUrl: './note.page.html',
  styleUrl: './note.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotePage {
  private readonly notes = inject(NOTES_SERVICE);
  private readonly titleBox = viewChild(PageTitleComponent);

  protected readonly state = signal<State>('loading');
  protected readonly page = signal<NotePageDto | null>(null);
  protected readonly title = signal('');
  protected readonly editable = computed(() => !!this.page()?.canEdit && !this.page()?.archivedAt);
  protected readonly titleOf = titleOf;
  private id = '';

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => {
        this.id = params.get('id') ?? '';
        void this.load(true);
      });
  }

  protected retry(): void {
    void this.load(false);
  }

  protected onTitle(value: string): void {
    this.title.set(value);
  }

  private async load(focusTitle: boolean): Promise<void> {
    this.state.set('loading');
    try {
      const page = await firstValueFrom(this.notes.get(this.id));
      this.page.set(page);
      this.title.set(page.title);
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
