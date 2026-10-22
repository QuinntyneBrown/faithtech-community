import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  MIN_SEARCH_LENGTH,
  SEARCH_SERVICE,
  SearchResultGroup,
  SearchResultItem,
  SearchResultKind,
} from '@faithtech-community/api';
import {
  BadgeVariant,
  ButtonComponent,
  ClusterComponent,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  SearchGroup,
  SearchResultItem as ResultView,
  SearchResultsComponent,
  TextFieldComponent,
  avatarColorFor,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'idle' | 'short' | 'loading' | 'loaded' | 'error';

const TITLES: Record<SearchResultKind, string> = {
  Person: 'People',
  Event: 'Events',
  Partner: 'Partners',
  Contact: 'Your private contacts',
  WorkItem: 'Work items in your workspaces',
  Resource: 'Resources',
};
const RESOURCE_ICONS: Record<string, string> = {
  Deck: 'deck',
  Logo: 'logo',
  Image: 'image',
  Training: 'training',
  Template: 'template',
  Document: 'document',
  Other: 'file',
};
const STAGES: Record<string, { label: string; variant: BadgeVariant }> = {
  Lead: { label: 'Lead', variant: 'neutral' },
  InFunnel: { label: 'In funnel', variant: 'warning' },
  Confirmed: { label: 'Confirmed', variant: 'success' },
};
const STATUSES: Record<string, string> = { ToDo: 'To do', InProgress: 'In progress', Done: 'Done' };

/**
 * Global search (L2-026, mock `pages/search`). The term lives in the address (`/search?q=`), so the top
 * bar's search box and this page's form both land here. Under 2 characters no search runs and a hint shows.
 */
@Component({
  selector: 'ft-search-page',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    ClusterComponent,
    EmptyStateComponent,
    FormFieldComponent,
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
  private readonly service = inject(SEARCH_SERVICE);
  private readonly router = inject(Router);

  /** The `q` query parameter. */
  readonly q = input<string>();

  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly state = signal<State>('idle');
  protected readonly term = signal('');
  protected readonly groups = signal<SearchGroup[]>([]);
  protected readonly hint = computed(() =>
    this.state() === 'short' ? `Type at least ${MIN_SEARCH_LENGTH} characters to search.` : '',
  );
  private request = 0;

  constructor() {
    effect(() => {
      const q = (this.q() ?? '').trim();
      this.query.setValue(q);
      void this.run(q);
    });
  }

  protected submit(): void {
    const q = this.query.value.trim();
    void this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }

  protected retry(): void {
    void this.run(this.term());
  }

  private async run(term: string): Promise<void> {
    const request = ++this.request;
    this.term.set(term);
    if (!term) {
      this.state.set('idle');
      return;
    }
    if (term.length < MIN_SEARCH_LENGTH) {
      this.state.set('short');
      return;
    }
    this.state.set('loading');
    try {
      const results = await firstValueFrom(this.service.search(term));
      if (request !== this.request) return;
      this.groups.set(results.groups.map((g) => toGroup(g, term)));
      this.state.set('loaded');
    } catch {
      if (request === this.request) this.state.set('error');
    }
  }
}

function toGroup(group: SearchResultGroup, term: string): SearchGroup {
  return {
    id: group.kind,
    title: TITLES[group.kind],
    items: group.items.map((i) => toView(group.kind, i)),
    // The Resources page searches the same fields, with filters and paging (L2-065 AC1).
    more:
      group.kind === 'Resource'
        ? { label: 'See all in Resources', href: `/resources?q=${encodeURIComponent(term)}` }
        : undefined,
  };
}

function toView(kind: SearchResultKind, item: SearchResultItem): ResultView {
  const base = { title: item.title, href: item.route, meta: item.snippet };
  switch (kind) {
    case 'Person':
      return { ...base, avatarName: item.title, avatarColor: avatarColorFor(item.id) };
    case 'Event':
      return {
        ...base,
        icon: 'events',
        meta: [item.startsAt ? formatDay(item.startsAt) : '', item.snippet]
          .filter(Boolean)
          .join(' · '),
        badge: item.badge ?? undefined,
        badgeVariant: item.badge === 'Cancelled' ? 'danger' : 'info',
      };
    case 'Partner': {
      const stage = STAGES[item.badge ?? ''];
      return {
        ...base,
        avatarName: item.title,
        avatarColor: avatarColorFor(item.id),
        badge: stage?.label,
        badgeVariant: stage?.variant,
      };
    }
    case 'Contact':
      return {
        ...base,
        avatarName: item.title,
        avatarColor: avatarColorFor(item.id),
        badge: 'Private',
        badgeVariant: 'neutral',
      };
    case 'Resource':
      return {
        ...base,
        icon: RESOURCE_ICONS[item.snippet.split(' · ')[0]] ?? 'resources',
        badge: item.badge ?? undefined,
        badgeVariant: item.badge === 'Private' ? 'neutral' : 'info',
      };
    case 'WorkItem':
      return {
        ...base,
        icon: 'workspaces',
        meta: item.snippet
          .split(' · ')
          .map((part) => STATUSES[part] ?? part)
          .join(' · '),
      };
  }
}
