import { Locator, Page } from '@playwright/test';

/** The signed-in chrome around every member page. */
export class AppShell {
  readonly verifyBanner: Locator;
  readonly sendVerificationAgain: Locator;
  readonly skipLink: Locator;
  readonly primaryNav: Locator;
  /** The tab bar's last tab, a button that opens the menu of every section. */
  readonly moreTab: Locator;
  readonly drawer: Locator;
  readonly closeDrawer: Locator;
  readonly tabBar: Locator;

  constructor(private readonly page: Page) {
    this.verifyBanner = page.locator('ft-banner').filter({ hasText: 'Verify your email' });
    this.sendVerificationAgain = this.verifyBanner.getByRole('button', { name: 'Send again' });
    this.skipLink = page.getByRole('link', { name: 'Skip to content' });
    this.primaryNav = page.locator('header').getByRole('navigation', { name: 'Primary' });

    this.drawer = page.getByRole('dialog', { name: 'Main menu' });
    this.closeDrawer = this.drawer.getByRole('button', { name: 'Close menu' });
    this.tabBar = page.getByRole('navigation', { name: 'Primary, phone' });
    this.moreTab = this.tabBar.getByRole('button', { name: 'More' });
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

  /** The initials circle on the top bar's account menu button. */
  yourAvatar(name: string): Locator {
    return this.accountMenu(name).locator('.ft-avatar');
  }

  /** The tab bar's labels, in order. */
  async tabLabels(): Promise<string[]> {
    return (await this.tabBar.getByRole('link').allTextContents()).map((t) => t.trim());
  }

  /** The top bar's section links, in order (including those hidden at the current width). */
  async navLabels(): Promise<string[]> {
    return (await this.primaryNav.getByRole('link').allTextContents()).map((t) => t.trim());
  }

  /** A link tab of the tab bar. */
  tab(name: string): Locator {
    return this.tabBar.getByRole('link', { name, exact: true });
  }

  navLink(name: string): Locator {
    return this.primaryNav.getByRole('link', { name, exact: true });
  }

  drawerLink(name: string): Locator {
    return this.drawer.getByRole('link', { name, exact: true });
  }
}
