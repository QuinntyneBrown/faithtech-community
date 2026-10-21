import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AUTH_SERVICE, ROLE_LABELS } from '@faithtech-community/api';
import {
  avatarColorFor,
  AvatarComponent,
  BannerComponent,
  BreakpointService,
  ButtonComponent,
  MenuComponent,
  MenuEntry,
  NavDrawerComponent,
  NavDrawerLink,
  SkipLinkComponent,
  TabBarComponent,
  TabBarItem,
  TopBarComponent,
  TopBarLink,
} from '@faithtech-community/components';
import { filter, firstValueFrom, map } from 'rxjs';

import { Section, sectionsFor, tabsFor } from './navigation';

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
    MenuComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly auth = inject(AUTH_SERVICE);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointService);

  protected readonly user = this.auth.currentUser;
  protected readonly avatarColor = computed(() => avatarColorFor(this.user()?.profileId));
  /** Unverified members can browse but must verify to RSVP, create content or invite (L2-002 AC3). */
  protected readonly unverified = computed(() => this.user()?.emailVerified === false);
  protected readonly resend = signal<'idle' | 'sending' | 'sent' | 'limited'>('idle');

  /** Under 768px the navigation collapses into the menu and the tab bar (L2-045 AC2). */
  protected readonly phone = computed(() => ['base', 'sm'].includes(this.breakpoint.current()));
  protected readonly menuOpen = signal(false);

  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  /** One rule for every role builds the top bar, the tab bar and the menu (ADR 0008). */
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
