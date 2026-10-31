import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ArchivedResource, OrganisationNames, RESOURCES_SERVICE } from '@faithtech-community/api';
import {
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
  ToastService,
  formatDay,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

import { fileOrHost, typeIcon } from '../../resource-format';

type State = 'loading' | 'loaded' | 'error';

const DAY = 24 * 60 * 60 * 1000;

/** The owner's archived resources with Restore (L2-063 AC3, AC4), as in docs/mocks/pages/archived-resources. */
@Component({
  selector: 'ft-archived-resources-page',
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
  templateUrl: './archived-resources.page.html',
  styleUrl: './archived-resources.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivedResourcesPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly resources = inject(RESOURCES_SERVICE);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly state = signal<State>('loading');
  protected readonly list = signal<ArchivedResource[]>([]);
  protected readonly restoring = signal<string | null>(null);
  protected readonly typeIcon = typeIcon;

  constructor() {
    void this.load();
  }

  /** "City launch deck · Deck · PPTX · 24.6 MB · archived Mon 13 Oct · deleted for good Wed 12 Nov" */
  protected meta(resource: ArchivedResource): string {
    const days = Math.ceil((new Date(resource.purgeAt).getTime() - Date.now()) / DAY);
    const soon = days >= 0 && days <= 7 ? `, in ${days} ${days === 1 ? 'day' : 'days'}` : '';
    return [
      resource.type,
      fileOrHost(resource),
      `archived ${formatDay(resource.archivedAt)}`,
      `deleted for good ${formatDay(resource.purgeAt)}${soon}`,
    ].join(' · ');
  }

  protected retry(): void {
    void this.load();
  }

  protected async restore(resource: ArchivedResource): Promise<void> {
    if (this.restoring()) return;
    this.restoring.set(resource.id);
    try {
      await firstValueFrom(this.resources.restore(resource.id));
      this.list.update((list) => list.filter((r) => r.id !== resource.id));
      this.toasts.show({
        variant: 'success',
        heading: `${resource.title} restored`,
        text: 'It’s back in Resources, with the same visibility as before.',
        actionLabel: 'View',
        onAction: () => void this.router.navigate(['/resources', resource.id]),
      });
    } catch {
      this.toasts.show({
        variant: 'danger',
        heading: `${resource.title} wasn’t restored`,
        text: `We couldn’t reach ${this.organisation.shortName()}. It’s still archived.`,
        actionLabel: 'Try again',
        onAction: () => void this.restore(resource),
      });
    } finally {
      this.restoring.set(null);
    }
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.list.set(await firstValueFrom(this.resources.archived()));
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
