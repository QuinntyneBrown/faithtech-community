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

  constructor(private readonly page: Page) {
    this.verifyBanner = page.locator('ft-banner').filter({ hasText: 'Verify your email' });
    this.sendVerificationAgain = this.verifyBanner.getByRole('button', { name: 'Send again' });
    this.skipLink = page.getByRole('link', { name: 'Skip to content' });
    this.primaryNav = page.locator('header').getByRole('navigation', { name: 'Primary' });
    this.menuButton = page.getByRole('button', { name: 'Open menu' });
    this.drawer = page.getByRole('dialog', { name: 'Main menu' });
    this.closeDrawer = this.drawer.getByRole('button', { name: 'Close menu' });
    this.tabBar = page.getByRole('navigation', { name: 'Primary, phone' });
  }

  /** The top bar's avatar, a menu button named "Account menu for {name}". */
  accountMenu(name: string): Locator {
    return this.page.getByRole('button', { name: `Account menu for ${name}` });
  }

  /** An item of the open account menu, such as "Your profile", "Settings" or "Sign out". */
  menuItem(name: string): Locator {
    return this.page.getByRole('menu').getByRole('menuitem', { name, exact: true });
  }

  /** Opens the account menu and follows "Your profile". */
  async openYourProfile(name: string): Promise<void> {
    await this.accountMenu(name).click();
    await this.menuItem('Your profile').click();
  }

  /** Opens the account menu and chooses "Sign out". */
  async signOut(name: string): Promise<void> {
    await this.accountMenu(name).click();
    await this.menuItem('Sign out').click();
  }

  navLink(name: string): Locator {
    return this.primaryNav.getByRole('link', { name, exact: true });
  }

  drawerLink(name: string): Locator {
    return this.drawer.getByRole('link', { name, exact: true });
  }
}
