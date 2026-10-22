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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  MIN_SEARCH_LENGTH,
  SEARCH_SERVICE,
  SearchResultGroup,
  SearchResultKind,
} from '@faithtech-community/api';
import {
  ButtonComponent,
  ClusterComponent,
  EmptyStateComponent,
  IconComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  SearchGroup,
  SearchResultsComponent,
  TextFieldComponent,
  avatarColorFor,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'idle' | 'short' | 'loading' | 'loaded' | 'error';

const HEADINGS: Record<SearchResultKind, string> = {
  Person: 'People',
  Event: 'Events',
  Partner: 'Partners',
  Contact: 'Your private contacts',
  WorkItem: 'Work items in your workspaces',
};

/**
 * Global search (L2-026), matching docs/mocks/pages/search. The term lives in the address (`?q=`), so the
 * top bar's search and a shared link land here. The server decides which groups the caller may see.
 */
@Component({
  selector: 'ft-search-page',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    ClusterComponent,
    EmptyStateComponent,
    IconComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    SearchResultsComponent,
    TextFieldComponent,
  ],
  templateUrl: './search.page.html',
  styleUrl: './search.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage {
  private readonly searchService = inject(SEARCH_SERVICE);
  private readonly router = inject(Router);

  /** From `?q=` through the router's input binding. */
  readonly q = input<string | undefined>();

  protected readonly field = new FormControl('', { nonNullable: true });
  protected readonly state = signal<State>('idle');
  protected readonly term = computed(() => (this.q() ?? '').trim());
  private readonly groups = signal<SearchResultGroup[]>([]);
  private request = 0;

  protected readonly resultGroups = computed<SearchGroup[]>(() =>
    this.groups().map((group) => ({
      id: group.kind,
      title: HEADINGS[group.kind],
      items: group.items.map((item) => ({
        title: item.title,
        href: item.route,
        meta: item.snippet,
        ...(group.kind === 'Person' || group.kind === 'Contact'
          ? {
              avatarName: item.title,
              avatarColor: group.kind === 'Person' ? avatarColorFor(item.id) : 'plain',
            }
          : {}),
        ...(group.kind === 'Contact' ? { badge: 'Private' } : {}),
      })),
    })),
  );

  constructor() {
    effect(() => {
      const term = this.term();
      untracked(() => {
        this.field.setValue(term);
        void this.search(term);
      });
    });
  }

  protected submit(): void {
    const q = this.field.value.trim();
    void this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }

  protected retry(): void {
    void this.search(this.term());
  }

  private async search(term: string): Promise<void> {
    const request = ++this.request;
    if (term === '') {
      this.state.set('idle');
      return;
    }
    // Under the minimum no search runs (L2-026 AC4).
    if (term.length < MIN_SEARCH_LENGTH) {
      this.state.set('short');
      return;
    }
    this.state.set('loading');
    try {
      const results = await firstValueFrom(this.searchService.search(term));
      if (request !== this.request) return;
      this.groups.set(results.groups.filter((g) => g.items.length > 0));
      this.state.set('loaded');
    } catch {
      if (request === this.request) this.state.set('error');
    }
  }
}
