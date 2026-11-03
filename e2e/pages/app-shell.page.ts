import { Locator, Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

/** The signed-in chrome around every member page. */
export class AppShell {
  readonly verifyBanner: Locator;
  readonly sendVerificationAgain: Locator;
  readonly skipLink: Locator;
  readonly primaryNav: Locator;
  /** The tab bar's last tab, a button that opens the menu of every section. */
  readonly moreTab: Locator;
  /** The top bar's More, shown between 768px and 1535px where the secondary links hide. */
  readonly moreLink: Locator;
  readonly drawer: Locator;
  readonly closeDrawer: Locator;
  readonly tabBar: Locator;
  /** The live region in the bottom corner that holds every toast. */
  readonly toastRegion: Locator;
  /** The routed page's header, which spans the content column. */
  readonly pageHeader: Locator;
  readonly toasts: Locator;
  /** The main landmark, where focus lands when nothing better is left. */
  readonly main: Locator;
  /** The top bar's bell, named "Notifications" or "Notifications, {n} unread". */
  readonly bell: Locator;
  /** The panel the bell opens. */
  readonly notificationPanel: Locator;
  /** The top bar's brand link, named with the organisation's short name (L2-134 AC1). */
  readonly brand: Locator;

  constructor(private readonly page: Page) {
    this.verifyBanner = page.locator('ft-banner').filter({ hasText: 'Verify your email' });
    this.sendVerificationAgain = this.verifyBanner.getByRole('button', { name: 'Send again' });
    this.skipLink = page.getByRole('link', { name: 'Skip to content' });
    this.primaryNav = page.locator('header').getByRole('navigation', { name: 'Primary' });

    this.drawer = page.getByRole('dialog', { name: 'Main menu' });
    this.closeDrawer = this.drawer.getByRole('button', { name: 'Close menu' });
    this.tabBar = page.getByRole('navigation', { name: 'Primary, phone' });
    this.moreTab = this.tabBar.getByRole('button', { name: 'More' });
    this.moreLink = this.primaryNav.getByRole('button', { name: 'More' });
    this.toastRegion = page.locator('ft-toast-region');
    this.pageHeader = page.getByRole('main').locator('ft-page-header');
    this.toasts = this.toastRegion.locator('ft-toast');
    this.main = page.getByRole('main');
    this.bell = page.locator('header').getByRole('button', { name: /^Notifications/ });
    this.notificationPanel = page.getByRole('dialog', { name: 'Notifications' });
    this.brand = page.getByRole('banner').locator('.top-bar__brand');
  }

  /** The top bar's capsule and the page's content column, side by side (L2-045 AC5). */
  async barAndColumn(): Promise<{ bar: Box; column: Box }> {
    const bar = await this.page.locator('header.top-bar').boundingBox();
    const column = await this.pageHeader.boundingBox();
    if (!bar || !column) throw new Error('The top bar or the page header is not on screen');
    return { bar, column };
  }

  /** The top bar's capsule and its last part, the account menu button, to check nothing spills out. */
  async barAndAccount(name: string): Promise<{ bar: Box; account: Box }> {
    const bar = await this.page.locator('header.top-bar').boundingBox();
    const account = await this.accountMenu(name).boundingBox();
    if (!bar || !account) throw new Error('The top bar or the account menu is not on screen');
    return { bar, account };
  }

  /**
   * Opens a section as a member does at the current width: its top-bar link when the bar shows it, otherwise
   * through the top bar's More (768px to 1535px, L2-045 AC5).
   */
  async openSection(name: string): Promise<void> {
    if (await this.navLink(name).isVisible()) return this.navLink(name).click();
    await this.moreLink.click();
    await this.drawerLink(name).click();
  }

  /** The top bar's search box (wider screens). */
  get topSearch(): Locator {
    return this.page.locator('header').getByRole('search').getByRole('searchbox');
  }

  /** Searches from the top bar, as a member does from any page. */
  async searchFromTopBar(term: string): Promise<void> {
    await this.topSearch.fill(term);
    await this.topSearch.press('Enter');
  }

  /** A notice in the open bell panel, found by its link text. */
  panelNotice(title: string): Locator {
    return this.notificationPanel.getByRole('link', { name: title, exact: true });
  }

  /** The photo on a panel notice's avatar; absent when the actor has none. */
  panelNoticePhoto(title: string): Locator {
    return this.notificationPanel
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('link', { name: title, exact: true }) })
      .locator('ft-avatar img');
  }

  /** The panel's "Mark all read" and "See all" controls. */
  get panelMarkAllRead(): Locator {
    return this.notificationPanel.getByRole('button', { name: 'Mark all read' });
  }

  get panelSeeAll(): Locator {
    return this.notificationPanel.getByRole('link', { name: 'See all' });
  }

  /** Moves keyboard focus to a toast's Dismiss button, as Tab would. */
  async focusToastDismiss(heading: string): Promise<void> {
    await this.toasts.filter({ hasText: heading }).getByRole('button', { name: 'Dismiss' }).focus();
  }

  /** Closes a toast with its Dismiss button and waits for it to go. */
  async dismissToast(heading: string): Promise<void> {
    const toast = this.toasts.filter({ hasText: heading });
    await toast.getByRole('button', { name: 'Dismiss' }).click();
    await toast.waitFor({ state: 'detached' });
  }

  /** The top bar's avatar, a menu button named "Account menu for {name}". */
  accountMenu(name: string): Locator {
    return this.page.getByRole('button', { name: `Account menu for ${name}` });
  }

  /** An item of the open account menu, such as "Your profile", "Settings" or "Sign out". */
  menuItem(name: string): Locator {
    return this.page.getByRole('menu').getByRole('menuitem', { name, exact: true });
  }

  /** The open account menu's "Switch organisation" group header (L2-133 AC3). */
  get switchOrganisation(): Locator {
    return this.page.getByRole('menu').getByText('Switch organisation', { exact: true });
  }

  /** An organisation offered in the open account menu's "Switch organisation" group, by name. */
  organisationToSwitchTo(name: string): Locator {
    return this.page.getByRole('menuitem', { name: new RegExp(`^${name}`) });
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

  /** Your featured photo on the top bar's account menu button; absent when you have none. */
  yourPhoto(name: string): Locator {
    return this.accountMenu(name).locator('img');
  }

  /** The tab bar's labels, in order. */
  async tabLabels(): Promise<string[]> {
    return (await this.tabBar.getByRole('link').allTextContents()).map((t) => t.trim());
  }

  /** The top bar's section links, in order (including those hidden at the current width). */
  async navLabels(): Promise<string[]> {
    return (await this.primaryNav.getByRole('link', { includeHidden: true }).allTextContents()).map(
      (t) => t.trim(),
    );
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
