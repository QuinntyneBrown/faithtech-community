import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ArchivedNote, NOTES_SERVICE } from '@faithtech-community/api';
import {
  BreadcrumbComponent,
  BreadcrumbItemComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  IconComponent,
  IconTileComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { RestoreNoteDialog } from '../../dialogs';

type State = 'loading' | 'loaded' | 'error';

/** The owner's archived pages with Restore (L2-095 AC3, AC4), as in docs/mocks/pages/archived-notes. */
@Component({
  selector: 'ft-archived-notes-page',
  imports: [
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    IconTileComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
  ],
  templateUrl: './archived-notes.page.html',
  styleUrl: './archived-notes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivedNotesPage {
  private readonly notes = inject(NOTES_SERVICE);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly state = signal<State>('loading');
  protected readonly list = signal<ArchivedNote[]>([]);

  constructor() {
    void this.load();
  }

  protected meta(note: ArchivedNote): string {
    return `archived ${formatDay(note.archivedAt)}`;
  }

  protected retry(): void {
    void this.load();
  }

  protected restore(note: ArchivedNote): void {
    this.dialogs.open<boolean>(RestoreNoteDialog, { data: note }).closed.subscribe((restored) => {
      if (!restored) return;
      this.list.update((list) => list.filter((n) => n.id !== note.id));
      this.toasts.show({
        variant: 'success',
        heading: `${note.title} restored`,
        text: 'It’s back in Notes, with the same visibility as before.',
        actionLabel: 'View',
        onAction: () => void this.router.navigate(['/notes', note.id]),
      });
    });
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.list.set(await firstValueFrom(this.notes.archived()));
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
