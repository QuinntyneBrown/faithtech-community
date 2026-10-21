import { Locator, Page } from '@playwright/test';

/** The signed-in chrome around every member page. */
export class AppShell {
  readonly verifyBanner: Locator;
  readonly sendVerificationAgain: Locator;
  readonly skipLink: Locator;
  readonly primaryNav: Locator;
  readonly menuButton: Locator;
  readonly drawer: Locator;
  readonly closeDrawer: Locator;
  readonly tabBar: Locator;
  readonly signOut: Locator;

  constructor(private readonly page: Page) {
    this.verifyBanner = page.locator('ft-banner').filter({ hasText: 'Verify your email' });
    this.sendVerificationAgain = this.verifyBanner.getByRole('button', { name: 'Send again' });
    this.skipLink = page.getByRole('link', { name: 'Skip to content' });
    this.primaryNav = page.locator('header').getByRole('navigation', { name: 'Primary' });
    this.menuButton = page.getByRole('button', { name: 'Open menu' });
    this.drawer = page.getByRole('dialog', { name: 'Main menu' });
    this.closeDrawer = this.drawer.getByRole('button', { name: 'Close menu' });
    this.tabBar = page.getByRole('navigation', { name: 'Primary, phone' });
    this.signOut = page.getByRole('button', { name: 'Sign out' });
  }

  navLink(name: string): Locator {
    return this.primaryNav.getByRole('link', { name, exact: true });
  }

  drawerLink(name: string): Locator {
    return this.drawer.getByRole('link', { name, exact: true });
  }
}
