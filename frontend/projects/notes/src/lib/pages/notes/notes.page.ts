import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NOTES_SERVICE, NotePageSummary, NoteQuery } from '@faithtech-community/api';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ChipComponent,
  ChipGroupComponent,
  ClusterComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  IconTileComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  TextFieldComponent,
  ToastService,
} from '@faithtech-community/components';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

import { badgeOf, editedLine, titleOf } from '../../note-format';

type State = 'loading' | 'loaded' | 'error';
type Owner = NonNullable<NoteQuery['owner']>;

/** The pages a member may open, recently edited first, by owner and text (L2-085), as in docs/mocks/pages/notes. */
@Component({
  selector: 'ft-notes-page',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ChipComponent,
    ChipGroupComponent,
    ClusterComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    IconTileComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    TextFieldComponent,
  ],
  templateUrl: './notes.page.html',
  styleUrl: './notes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotesPage {
  private readonly notes = inject(NOTES_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly owners: { id: Owner; label: string }[] = [
    { id: 'all', label: 'All pages' },
    { id: 'mine', label: 'Mine' },
    { id: 'shared', label: 'Shared with me' },
  ];
  protected readonly search = new FormControl(
    inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '',
    { nonNullable: true },
  );

  protected readonly state = signal<State>('loading');
  protected readonly items = signal<NotePageSummary[]>([]);
  protected readonly count = signal(0);
  /** Every page the member may open, for the subheading. */
  protected readonly total = signal<number | null>(null);
  protected readonly owner = signal<Owner>('all');
  protected readonly term = signal(this.search.value.trim());
  protected readonly page = signal(1);
  protected readonly loadingMore = signal(false);
  protected readonly creating = signal(false);

  protected readonly filtered = computed(() => this.owner() !== 'all' || !!this.term());
  protected readonly subtitle = computed(() => {
    const total = this.total();
    const count =
      total === null ? '' : total === 0 ? ' · none yet' : ` · ${total} ${plural(total)}`;
    return `Meeting notes, playbooks and how-tos${count}`;
  });
  protected readonly hasMore = computed(() => this.items().length < this.count());

  protected readonly titleOf = titleOf;
  protected readonly editedLine = editedLine;
  protected readonly badgeOf = badgeOf;

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((value) => {
        this.term.set(value.trim());
        void this.load();
      });
    void this.load();
  }

  protected chooseOwner(owner: Owner): void {
    this.owner.set(owner);
    void this.load();
  }

  protected clearSearch(): void {
    this.term.set('');
    this.owner.set('all');
    this.search.setValue('', { emitEvent: false });
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  /** Creates an untitled Private page and opens it (L2-085 AC6). */
  protected async create(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      const page = await firstValueFrom(this.notes.create());
      await this.router.navigate(['/notes', page.id]);
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'Page not created',
        text: 'We couldn’t reach FaithTech. Try again.',
      });
    } finally {
      this.creating.set(false);
    }
  }

  protected async showMore(): Promise<void> {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    try {
      const next = await firstValueFrom(this.notes.list(this.query(this.page() + 1)));
      this.page.set(next.page);
      this.items.update((items) => [...items, ...next.items]);
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t load more pages',
        text: 'Check your connection and try again.',
      });
    } finally {
      this.loadingMore.set(false);
    }
  }

  private query(page = 1): NoteQuery {
    return { q: this.term(), owner: this.owner(), page };
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const result = await firstValueFrom(this.notes.list(this.query()));
      this.items.set(result.items);
      this.count.set(result.totalCount);
      this.page.set(result.page);
      if (!this.filtered()) this.total.set(result.totalCount);
      else if (this.total() === null) {
        const all = await firstValueFrom(this.notes.list({}));
        this.total.set(all.totalCount);
      }
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}

function plural(n: number): string {
  return n === 1 ? 'page' : 'pages';
}
