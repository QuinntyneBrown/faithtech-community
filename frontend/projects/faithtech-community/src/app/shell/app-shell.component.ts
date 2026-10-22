import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  AUTH_SERVICE,
  NOTIFICATIONS_SERVICE,
  NotificationDto,
  ROLE_LABELS,
} from '@faithtech-community/api';
import {
  avatarColorFor,
  AvatarComponent,
  BannerComponent,
  BreakpointService,
  ButtonComponent,
  ContainerComponent,
  MenuComponent,
  MenuEntry,
  NavDrawerComponent,
  NavDrawerLink,
  Notice,
  NotificationBellComponent,
  NotificationPanelComponent,
  SkipLinkComponent,
  TabBarComponent,
  TabBarItem,
  TopBarComponent,
  TopBarLink,
  toNotice,
} from '@faithtech-community/components';
import { filter, firstValueFrom, interval, map } from 'rxjs';

import { Section, sectionsFor, tabsFor } from './navigation';

/** How often the bell reads the unread count while the tab is visible (ADR 0015). */
const UNREAD_POLL_MS = 60_000;
/** The panel shows the latest few; the Notifications page holds the history. */
const PANEL_SIZE = 5;

/** The signed-in chrome around every member page (docs/design-system/patterns/navigation.html). */
@Component({
  selector: 'ft-app-shell',
  imports: [
    RouterOutlet,
    AvatarComponent,
    SkipLinkComponent,
    TopBarComponent,
    NavDrawerComponent,
    TabBarComponent,
    BannerComponent,
    ButtonComponent,
    ContainerComponent,
    MenuComponent,
    NotificationBellComponent,
    NotificationPanelComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly auth = inject(AUTH_SERVICE);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointService);
  private readonly notifications = inject(NOTIFICATIONS_SERVICE);

  protected readonly user = this.auth.currentUser;
  protected readonly avatarColor = computed(() => avatarColorFor(this.user()?.profileId));
  /** Unverified members can browse but must verify to RSVP, create content or invite (L2-002 AC3). */
  protected readonly unverified = computed(() => this.user()?.emailVerified === false);
  protected readonly resend = signal<'idle' | 'sending' | 'sent' | 'limited'>('idle');

  /** Under 768px the navigation collapses into the menu and the tab bar (L2-045 AC2). */
  protected readonly phone = computed(() => ['base', 'sm'].includes(this.breakpoint.current()));
  /** From 768px to 1023px the secondary links hide, so More in the top bar opens the menu. */
  protected readonly tablet = computed(() => this.breakpoint.current() === 'md');
  protected readonly menuOpen = signal(false);

  /** The bell (L2-027): the count, and the latest notices once the panel opens. */
  protected readonly unread = signal(0);
  protected readonly bellOpen = signal(false);
  private readonly latest = signal<NotificationDto[]>([]);
  protected readonly notices = computed<Notice[]>(() => this.latest().map((n) => toNotice(n)));

  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  /** One rule for every role builds the top bar, the tab bar and the menu (ADR 0009). */
  private readonly sections = computed(() => sectionsFor(this.auth.roles()));

  protected readonly topLinks = computed<TopBarLink[]>(() =>
    this.sections().map((s) => ({ ...this.link(s), secondary: s.secondary })),
  );
  protected readonly drawerLinks = computed<NavDrawerLink[]>(() =>
    this.sections().map((s) => ({ ...this.link(s), icon: s.icon })),
  );
  /** The avatar's account menu, at every width (L2-003 AC9, design system components/menu). */
  protected readonly accountEntries = computed<MenuEntry[]>(() => [
    {
      kind: 'header',
      title: this.user()?.name ?? '',
      caption:
        this.auth
          .roles()
          .map((r) => ROLE_LABELS[r] ?? r)
          .join(', ') || 'No role yet',
    },
    { kind: 'divider' },
    { kind: 'item', id: 'profile', label: 'Your profile', icon: 'team', href: '/people/me' },
    { kind: 'item', id: 'settings', label: 'Settings', icon: 'settings', href: '/settings' },
    { kind: 'divider' },
    { kind: 'item', id: 'sign-out', label: 'Sign out', icon: 'sign-out' },
  ]);
  protected readonly tabs = computed<TabBarItem[]>(() =>
    tabsFor(this.auth.roles()).map((s) => ({ ...this.link(s), icon: s.icon })),
  );
  /** More is the current tab while the page is outside the link tabs (design system, tab bar). */
  protected readonly moreCurrent = computed(() => !this.tabs().some((t) => t.current));

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.readUnread());
    // Marking read on the Notifications page, or anywhere else, recounts the bell (L2-027 AC3).
    this.notifications.readChanged
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.readUnread());
    interval(UNREAD_POLL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (document.visibilityState !== 'hidden') void this.readUnread();
      });
    void this.readUnread();
  }

  protected async toggleBell(open: boolean): Promise<void> {
    this.bellOpen.set(open);
    if (!open) return;
    try {
      const page = await firstValueFrom(this.notifications.list(1));
      this.latest.set(page.items.slice(0, PANEL_SIZE));
      this.unread.set(page.unreadCount);
    } catch {
      // The panel shows what it had; the next poll tries again.
    }
  }

  protected async openNotice(id: string): Promise<void> {
    const item = this.latest().find((n) => n.id === id);
    if (!item) return;
    this.bellOpen.set(false);
    if (item.readAt === null) {
      try {
        await firstValueFrom(this.notifications.markRead(id));
        const now = new Date().toISOString();
        this.latest.update((all) => all.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
        this.unread.update((count) => Math.max(0, count - 1));
      } catch {
        // Still take them to the item; it stays unread and the count catches up on the next read.
      }
    }
    await this.router.navigateByUrl(item.linkPath);
  }

  protected async markAllRead(): Promise<void> {
    try {
      await firstValueFrom(this.notifications.markAllRead());
      const now = new Date().toISOString();
      this.latest.update((all) => all.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      this.unread.set(0);
    } catch {
      // Nothing changed on the server, so nothing changes here.
    }
  }

  private async readUnread(): Promise<void> {
    try {
      this.unread.set(await firstValueFrom(this.notifications.unreadCount()));
    } catch {
      // Keep the last count; the next navigation or poll tries again.
    }
  }

  protected search(query: string): void {
    void this.router.navigate(['/search'], { queryParams: query ? { q: query } : {} });
  }

  protected async accountAction(id: string): Promise<void> {
    if (id === 'sign-out') await firstValueFrom(this.auth.signOut());
  }

  protected async sendAgain(): Promise<void> {
    const email = this.user()?.email;
    if (!email) return;
    this.resend.set('sending');
    try {
      await firstValueFrom(this.auth.resendVerification(email));
      this.resend.set('sent');
    } catch (error) {
      const limited = error instanceof HttpErrorResponse && error.status === 429;
      this.resend.set(limited ? 'limited' : 'idle');
    }
  }

  private link(section: Section) {
    return { label: section.label, href: section.href, current: this.isCurrent(section.href) };
  }

  private isCurrent(href: string): boolean {
    const path = this.path();
    return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
  }
}
