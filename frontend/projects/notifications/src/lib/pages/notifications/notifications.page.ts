import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NOTIFICATIONS_SERVICE, NotificationDto } from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  ListSkeletonComponent,
  NoticeListComponent,
  PageHeaderComponent,
  toNotice,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'loading' | 'loaded' | 'error';

/** The caller's notifications, newest first (L2-027), matching docs/mocks/pages/notifications. */
@Component({
  selector: 'ft-notifications-page',
  imports: [
    ButtonComponent,
    CardComponent,
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
  private readonly notifications = inject(NOTIFICATIONS_SERVICE);
  private readonly router = inject(Router);

  protected readonly state = signal<State>('loading');
  protected readonly items = signal<NotificationDto[]>([]);
  protected readonly unread = signal(0);
  private readonly total = signal(0);
  private readonly page = signal(1);
  protected readonly loadingMore = signal(false);

  protected readonly notices = computed(() => this.items().map((n) => toNotice(n)));
  protected readonly hasMore = computed(() => this.items().length < this.total());
  protected readonly subtitle = computed(() =>
    this.unread() > 0 ? `${this.unread()} unread` : '',
  );

  constructor() {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected async showMore(): Promise<void> {
    this.loadingMore.set(true);
    try {
      const next = await firstValueFrom(this.notifications.list(this.page() + 1));
      this.page.set(next.page);
      this.items.update((items) => [...items, ...next.items]);
      this.unread.set(next.unreadCount);
      this.total.set(next.totalCount);
    } catch {
      // The button stays, so they can try again.
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected async open(id: string): Promise<void> {
    const item = this.items().find((n) => n.id === id);
    if (!item) return;
    if (item.readAt === null) {
      try {
        await firstValueFrom(this.notifications.markRead(id));
        const now = new Date().toISOString();
        this.items.update((all) => all.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
        this.unread.update((count) => Math.max(0, count - 1));
      } catch {
        // Still take them to the item; it stays unread.
      }
    }
    await this.router.navigateByUrl(item.linkPath);
  }

  protected async markAllRead(): Promise<void> {
    try {
      await firstValueFrom(this.notifications.markAllRead());
      const now = new Date().toISOString();
      this.items.update((all) => all.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      this.unread.set(0);
    } catch {
      // Nothing changed on the server, so nothing changes here.
    }
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const first = await firstValueFrom(this.notifications.list(1));
      this.page.set(1);
      this.items.set(first.items);
      this.unread.set(first.unreadCount);
      this.total.set(first.totalCount);
      this.state.set('loaded');
    } catch {
      this.state.set('error');
    }
  }
}
