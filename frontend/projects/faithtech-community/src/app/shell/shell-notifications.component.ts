import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { NOTIFICATIONS_SERVICE, NotificationDto } from '@faithtech-community/api';
import {
  Notice,
  NotificationBellComponent,
  NotificationPanelComponent,
  avatarColorFor,
  formatWhen,
} from '@faithtech-community/components';
import { filter, firstValueFrom } from 'rxjs';

/** How often the bell reloads while the tab is visible (ADR 0015). */
export const NOTIFICATIONS_REFRESH_MS = 60_000;

/**
 * The top bar's bell and panel (L2-027). Lives in the shell, not in the notifications library, so the shell
 * imports no feature library eagerly (ADR 0015). Reloads on every navigation and once a minute.
 */
@Component({
  selector: 'ft-shell-notifications',
  imports: [NotificationBellComponent, NotificationPanelComponent],
  templateUrl: './shell-notifications.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellNotificationsComponent {
  private readonly service = inject(NOTIFICATIONS_SERVICE);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly open = signal(false);
  protected readonly unread = signal(0);
  private readonly items = signal<NotificationDto[]>([]);
  protected readonly notices = computed<Notice[]>(() => this.items().map(toNotice));

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.load());
    const timer = setInterval(() => {
      if (this.document.visibilityState !== 'hidden') void this.load();
    }, NOTIFICATIONS_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    void this.load();
  }

  protected async openNotice(id: string): Promise<void> {
    const item = this.items().find((n) => n.id === id);
    if (!item) return;
    this.open.set(false);
    try {
      await firstValueFrom(this.service.markRead(id));
    } catch {
      // Opening the item matters more than the read mark; the next load shows the true state.
    }
    if (!item.readAt) this.unread.update((count) => Math.max(0, count - 1));
    this.markLocally((n) => n.id === id);
    await this.router.navigateByUrl(item.linkPath);
  }

  protected async markAllRead(): Promise<void> {
    await firstValueFrom(this.service.markAllRead());
    this.unread.set(0);
    this.markLocally(() => true);
  }

  private markLocally(match: (n: NotificationDto) => boolean): void {
    const now = new Date().toISOString();
    this.items.update((items) =>
      items.map((n) => (match(n) && !n.readAt ? { ...n, readAt: now } : n)),
    );
  }

  private async load(): Promise<void> {
    try {
      const page = await firstValueFrom(this.service.list());
      this.items.set(page.items);
      this.unread.set(page.unreadCount);
    } catch {
      // A failed refresh keeps the last notices; the next navigation or tick tries again.
    }
  }
}

function toNotice(n: NotificationDto): Notice {
  return {
    id: n.id,
    name: n.actorName ?? 'FaithTech',
    color: avatarColorFor(n.actorId),
    text: '',
    linkText: n.title,
    href: n.linkPath,
    meta: formatWhen(n.createdAt),
    unread: !n.readAt,
  };
}
