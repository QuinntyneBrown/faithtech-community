import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  NotificationDto,
  NOTIFICATIONS_SERVICE,
  OrganisationNames,
} from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  ChipComponent,
  ClusterComponent,
  EmptyStateComponent,
  IconComponent,
  ListSkeletonComponent,
  Notice,
  NoticeListComponent,
  PageHeaderComponent,
  avatarColorFor,
  formatFeedTime,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';

/**
 * Every notification of the signed-in member, newest first, 50 at a time (L2-027, mock
 * `pages/notifications`). Opening one marks it read, then goes to its item.
 */
@Component({
  selector: 'ft-notifications-page',
  imports: [
    ButtonComponent,
    CardComponent,
    ChipComponent,
    ClusterComponent,
    EmptyStateComponent,
    IconComponent,
    ListSkeletonComponent,
    NoticeListComponent,
    PageHeaderComponent,
  ],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  protected readonly organisation = inject(OrganisationNames);
  private readonly service = inject(NOTIFICATIONS_SERVICE);
  private readonly router = inject(Router);

  protected readonly state = signal<State>('loading');
  protected readonly unreadOnly = signal(false);
  protected readonly unread = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly loadingMore = signal(false);
  private readonly items = signal<NotificationDto[]>([]);
  private page = 1;
  private request = 0;

  protected readonly notices = computed<Notice[]>(() =>
    this.items().map((n) => toNotice(n, this.organisation.shortName())),
  );
  protected readonly subtitle = computed(() =>
    this.unread() > 0 ? `${this.unread()} unread` : null,
  );

  constructor() {
    void this.load();
  }

  protected show(unreadOnly: boolean): void {
    if (this.unreadOnly() === unreadOnly) return;
    this.unreadOnly.set(unreadOnly);
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected async showOlder(): Promise<void> {
    const request = this.request;
    this.loadingMore.set(true);
    try {
      const next = await firstValueFrom(
        this.service.list({ page: this.page + 1, unreadOnly: this.unreadOnly() }),
      );
      if (request !== this.request) return;
      this.page = next.page;
      this.items.update((items) => [...items, ...next.items]);
      this.hasMore.set(next.hasMore);
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected async open(id: string): Promise<void> {
    const item = this.items().find((n) => n.id === id);
    if (!item) return;
    try {
      await firstValueFrom(this.service.markRead(id));
    } catch {
      // Going to the item matters more than the read mark; the next load shows the true state.
    }
    await this.router.navigateByUrl(item.linkPath);
  }

  protected async markAllRead(): Promise<void> {
    await firstValueFrom(this.service.markAllRead());
    const now = new Date().toISOString();
    this.items.update((items) => items.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    this.unread.set(0);
  }

  private async load(): Promise<void> {
    // Only the latest request may update the page, so a slow answer never overwrites a newer filter.
    const request = ++this.request;
    this.state.set('loading');
    try {
      const first = await firstValueFrom(
        this.service.list({ page: 1, unreadOnly: this.unreadOnly() }),
      );
      if (request !== this.request) return;
      this.page = 1;
      this.items.set(first.items);
      this.unread.set(first.unreadCount);
      this.hasMore.set(first.hasMore);
      this.state.set('loaded');
    } catch {
      if (request === this.request) this.state.set('error');
    }
  }
}

function toNotice(n: NotificationDto, organisation: string): Notice {
  return {
    id: n.id,
    name: n.actorName ?? organisation,
    color: avatarColorFor(n.actorId),
    text: '',
    linkText: n.title,
    href: n.linkPath,
    meta: formatFeedTime(n.createdAt),
    unread: !n.readAt,
  };
}
