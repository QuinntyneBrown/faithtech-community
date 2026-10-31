import { HttpErrorResponse } from '@angular/common/http';
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
import {
  AUTH_SERVICE,
  OrganisationNames,
  RESOURCE_CONTRIBUTOR_ROLES,
  RESOURCE_TYPES,
  ResourceDto,
  RESOURCES_SERVICE,
  ResourceSummary,
  ResourceType,
} from '@faithtech-community/api';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ChipComponent,
  ClusterComponent,
  ChipGroupComponent,
  DialogService,
  EmptyStateComponent,
  FormFieldComponent,
  IconComponent,
  IconTileComponent,
  ListComponent,
  ListItemComponent,
  ListSkeletonComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
  TextFieldComponent,
  ToastService,
} from '@faithtech-community/components';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

import { AddResourceDialog, AddResourceResult } from '../../dialogs';
import {
  badgeOf,
  downloadLabel,
  metaLine,
  openLabel,
  saveBlob,
  typeIcon,
} from '../../resource-format';
import { ThumbnailCache } from '../../thumbnail-cache';

type State = 'loading' | 'loaded' | 'error';

/**
 * Resources, newest first, filtered by type, tag and search (L2-055), as in docs/mocks/pages/resources.
 * Contributors also get Add resource and Archived.
 */
@Component({
  selector: 'ft-resources-page',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ChipComponent,
    ClusterComponent,
    ChipGroupComponent,
    EmptyStateComponent,
    FormFieldComponent,
    IconComponent,
    IconTileComponent,
    ListComponent,
    ListItemComponent,
    ListSkeletonComponent,
    PageHeaderComponent,
    SelectComponent,
    TextFieldComponent,
  ],
  providers: [ThumbnailCache],
  templateUrl: './resources.page.html',
  styleUrl: './resources.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourcesPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly roles = inject(AUTH_SERVICE).roles;
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly thumbnails = inject(ThumbnailCache);

  protected readonly types = RESOURCE_TYPES;
  protected readonly search = new FormControl(
    inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '',
    { nonNullable: true },
  );
  protected readonly tag = new FormControl('', { nonNullable: true });

  protected readonly state = signal<State>('loading');
  protected readonly items = signal<ResourceSummary[]>([]);
  protected readonly count = signal(0);
  /** Every resource the member may open, for the subheading. */
  protected readonly total = signal<number | null>(null);
  protected readonly type = signal<ResourceType | null>(null);
  protected readonly term = signal(this.search.value.trim());
  protected readonly tagChoice = signal('');
  protected readonly tagOptions = signal<SelectOption[]>([]);
  protected readonly page = signal(1);
  protected readonly loadingMore = signal(false);

  protected readonly canAdd = computed(() =>
    this.roles().some((r) => RESOURCE_CONTRIBUTOR_ROLES.includes(r)),
  );
  protected readonly filtered = computed(
    () => !!this.type() || !!this.tagChoice() || !!this.term(),
  );
  protected readonly subtitle = computed(() => {
    const total = this.total();
    const count =
      total === null ? '' : total === 0 ? ' · none yet' : ` · ${total} ${plural(total)}`;
    return `Decks, logos, training and templates${count}`;
  });
  protected readonly filterLine = computed(() => {
    const n = this.count();
    const type = this.type() ? ` of type ${this.type()}` : '';
    const tag = this.tagChoice() ? ` tagged “${this.tagChoice()}”` : '';
    const term = this.term() ? ` matching “${this.term()}”` : '';
    return `${n} ${plural(n)}${type}${tag}${term}`;
  });
  protected readonly hasMore = computed(() => this.items().length < this.count());

  protected readonly metaLine = metaLine;
  protected readonly badgeOf = badgeOf;
  protected readonly typeIcon = typeIcon;
  protected readonly downloadLabel = downloadLabel;
  protected readonly openLabel = openLabel;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe((value) => {
        this.term.set(value.trim());
        void this.load();
      });
    this.tag.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((value) => {
      this.tagChoice.set(value);
      void this.load();
    });
    void this.load();
    void this.loadTags();
  }

  protected chooseType(type: ResourceType | null): void {
    this.type.set(type);
    void this.load();
  }

  protected clearFilters(): void {
    this.type.set(null);
    this.term.set('');
    this.tagChoice.set('');
    this.search.setValue('', { emitEvent: false });
    this.tag.setValue('', { emitEvent: false });
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected async showMore(): Promise<void> {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    try {
      const next = await firstValueFrom(this.resources.list(this.query(this.page() + 1)));
      this.page.set(next.page);
      this.items.update((items) => [...items, ...next.items]);
      this.thumbnails.load(next.items);
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: 'We couldn’t load more resources',
        text: 'Check your connection and try again.',
      });
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected async download(resource: ResourceSummary): Promise<void> {
    try {
      saveBlob(await firstValueFrom(this.resources.download(resource.id)), resource.fileName!);
    } catch (error) {
      this.toasts.show({
        variant: 'danger',
        heading: `${resource.title} didn’t download`,
        text:
          error instanceof HttpErrorResponse && error.status === 409
            ? 'This file is still uploading. Try again in a minute.'
            : `We couldn’t reach ${this.organisation.shortName()}. Try again.`,
      });
    }
  }

  protected async add(): Promise<void> {
    const ref = this.dialogs.open<AddResourceResult>(AddResourceDialog, {});
    const result = await firstValueFrom(ref.closed);
    if (!result?.added.length) return;
    void this.load();
    void this.loadTags();
    this.announce(result);
  }

  private announce(result: AddResourceResult): void {
    const { added, failed } = result;
    const total = added.length + failed;
    if (failed) {
      this.toasts.show({
        variant: 'warning',
        heading: `${added.length} of ${total} resources added`,
        text: `${failed} files didn’t upload.`,
      });
    } else if (added.length > 1) {
      this.toasts.show({
        variant: 'success',
        heading: `${added.length} resources added`,
        text: 'Titles came from the file names. Open any of them to edit the details.',
      });
    } else {
      const resource: ResourceDto = added[0];
      this.toasts.show({
        variant: 'success',
        heading: `${resource.title} added`,
        text: addedText(resource),
        actionLabel: 'View',
        onAction: () => void this.router.navigate(['/resources', resource.id]),
      });
    }
  }

  private query(page = 1) {
    return { q: this.term(), type: this.type(), tag: this.tagChoice() || null, page };
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const result = await firstValueFrom(this.resources.list(this.query()));
      this.items.set(result.items);
      this.count.set(result.totalCount);
      this.page.set(1);
      if (!this.filtered()) this.total.set(result.totalCount);
      else if (this.total() === null) void this.loadTotal();
      this.thumbnails.load(result.items);
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }

  private async loadTotal(): Promise<void> {
    try {
      this.total.set((await firstValueFrom(this.resources.list({}))).totalCount);
    } catch {
      // The subheading keeps its plain text.
    }
  }

  private async loadTags(): Promise<void> {
    try {
      const tags = await firstValueFrom(this.resources.tags());
      this.tagOptions.set(tags.map((t) => ({ value: t.name, label: t.name })));
    } catch {
      this.tagOptions.set([]);
    }
  }
}

function plural(n: number): string {
  return n === 1 ? 'resource' : 'resources';
}

export function addedText(resource: ResourceDto): string {
  return resource.visibility === 'Global'
    ? 'Every signed-in member can find it now.'
    : resource.visibility === 'Private'
      ? 'Only you can see it.'
      : 'Everyone you shared it with can find it now.';
}
