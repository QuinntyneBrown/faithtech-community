import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import { SignInPage } from '../../pages/sign-in.page';
import { BREAKPOINTS } from '../../pages/viewport';

// L2-045 AC2, L2-003 AC6 and AC9 (docs/detailed-designs/platform/responsive-layout-and-theming).
test.describe('App shell', () => {
  test('above XS the top bar shows the sections', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xl);
    const shell = new AppShell(page);

    await api.signInAs(api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }));

    for (const name of ['Home', 'Events', 'Contacts', 'Partners', 'Workspaces', 'Team', 'People']) {
      await expect(shell.navLink(name)).toBeVisible();
    }
    await expect(shell.navLink('Home')).toHaveAttribute('aria-current', 'page');
    await expect(shell.moreTab).toBeHidden();
    await expect(shell.tabBar).toBeHidden();
    await axe.check();
  });

  // One rule for every role (docs/adr/0009-shell-navigation-by-role.md); Reports for Staff and System Admin
  // only (L2-123 AC4, L2-045 AC4).
  const byRole: { roles: string[]; nav: string[]; tabs: string[] }[] = [
    {
      roles: ['CityLead'],
      nav: [
        'Home',
        'Events',
        'Contacts',
        'Partners',
        'Workspaces',
        'Team',
        'Announcements',
        'Resources',
        'Notes',
        'People',
      ],
      tabs: ['Home', 'Events', 'Search', 'Contacts'],
    },
    {
      roles: ['Staff'],
      nav: [
        'Home',
        'Events',
        'Partners',
        'Workspaces',
        'Team',
        'Announcements',
        'Resources',
        'Notes',
        'People',
        'Reports',
      ],
      tabs: ['Home', 'Events', 'Search', 'Partners'],
    },
    {
      roles: ['EventLead'],
      nav: [
        'Home',
        'Events',
        'Contacts',
        'Partners',
        'Workspaces',
        'Team',
        'Announcements',
        'Resources',
        'Notes',
      ],
      tabs: ['Home', 'Events', 'Search', 'Contacts'],
    },
    {
      roles: ['SystemAdmin'],
      nav: [
        'Home',
        'Events',
        'Contacts',
        'Partners',
        'Workspaces',
        'Team',
        'Announcements',
        'Resources',
        'Notes',
        'People',
        'Reports',
        'Admin',
      ],
      tabs: ['Home', 'Events', 'Search', 'Contacts'],
    },
    {
      roles: [],
      nav: ['Home', 'Events', 'Team', 'Announcements', 'Resources', 'Notes'],
      tabs: ['Home', 'Events', 'Search', 'Team'],
    },
  ];
  for (const { roles, nav, tabs } of byRole) {
    test(`the sections and tabs follow the roles: ${roles.join(', ') || 'no role'}`, async ({
      page,
      api,
    }) => {
      const shell = new AppShell(page);
      await page.setViewportSize(BREAKPOINTS.xl);
      await api.signInAs(api.addAccount({ email: 'grace@example.org', roles }));

      await expect(shell.navLink('Home')).toBeVisible();
      expect(await shell.navLabels()).toEqual(nav);

      await page.setViewportSize(BREAKPOINTS.xs);
      await expect(shell.tabBar).toBeVisible();
      expect(await shell.tabLabels()).toEqual(tabs);
      await expect(shell.moreTab).toBeVisible();
    });
  }

  test('on a page outside the tabs, More is the current tab', async ({ page, api, axe }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const shell = new AppShell(page);
    await api.signInAs(
      api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }),
      '/team',
    );

    await expect(shell.moreTab).toHaveAttribute('aria-current', 'true');
    await expect(shell.tabBar.locator('[aria-current="page"]')).toHaveCount(0);
    await axe.check();

    await shell.tab('Events').click();
    await expect(shell.tab('Events')).toHaveAttribute('aria-current', 'page');
    await expect(shell.moreTab).not.toHaveAttribute('aria-current');
  });

  test('at XS the tab bar More opens a menu of every section that traps and returns focus', async ({
    page,
    api,
    axe,
  }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }));

    await expect(shell.navLink('Events')).toBeHidden();
    await expect(shell.tabBar).toBeVisible();
    await shell.moreTab.click();

    await expect(shell.drawer).toBeVisible();
    for (const name of [
      'Home',
      'Events',
      'Contacts',
      'Partners',
      'Workspaces',
      'Team',
      'Announcements',
      'People',
    ]) {
      await expect(shell.drawerLink(name)).toBeVisible();
    }
    await axe.check();
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    expect(await shell.drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(shell.drawer).toBeHidden();
    await expect(shell.moreTab).toBeFocused();
  });

  test('on a tablet the hidden sections stay reachable through More', async ({
    page,
    api,
    axe,
  }) => {
    await page.setViewportSize(BREAKPOINTS.md);
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }));

    await expect(shell.navLink('Events')).toBeVisible();
    await expect(shell.navLink('Team')).toBeHidden();
    await expect(shell.tabBar).toBeHidden();
    await shell.moreLink.click();

    await expect(shell.drawer).toBeVisible();
    for (const name of ['Team', 'Announcements', 'People']) {
      await expect(shell.drawerLink(name)).toBeVisible();
    }
    await axe.check();
    await page.keyboard.press('Escape');
    await expect(shell.moreLink).toBeFocused();

    await page.setViewportSize(BREAKPOINTS.lg);
    await expect(shell.navLink('Team')).toBeVisible();
    await expect(shell.moreLink).toBeHidden();
  });

  test('the skip link is the first thing keyboard users reach', async ({ page, api }) => {
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }));

    await page.keyboard.press('Tab');

    await expect(new AppShell(page).skipLink).toBeFocused();
  });

  test('the account menu offers your profile, settings and sign out', async ({
    page,
    api,
    axe,
  }) => {
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' }));

    await shell.accountMenu('Grace Okonkwo').click();

    await expect(shell.menuItem('Your profile')).toHaveAttribute('href', '/people/me');
    await expect(shell.menuItem('Settings')).toHaveAttribute('href', '/settings');
    await expect(shell.menuItem('Sign out')).toBeVisible();
    await axe.check();
    await page.keyboard.press('Escape');
    await expect(shell.menuItem('Sign out')).toBeHidden();
    await expect(shell.accountMenu('Grace Okonkwo')).toBeFocused();
  });

  test('on a phone the account menu still offers sign out', async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' }));

    await shell.signOut('Grace Okonkwo');

    await expect(new SignInPage(page).heading).toBeVisible();
    expect(api.callsTo('POST', '/api/account/sign-out')[0]).toBeTruthy();
  });

  test('signing out revokes the session and returns to sign in', async ({ page, api }) => {
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' }));

    await shell.signOut('Grace Okonkwo');

    await expect(new SignInPage(page).heading).toBeVisible();
    expect(api.callsTo('POST', '/api/account/sign-out')[0]).toBeTruthy();
    await page.goto('/');
    await expect(new SignInPage(page).heading).toBeVisible();
  });
});
