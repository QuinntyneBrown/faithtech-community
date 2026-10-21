// Traces to: L2-005, L2-007 (docs/detailed-designs/profiles/view-profile)
import { expect, test } from '../../fixtures/app';
import { photoUrl } from '../../fixtures/mock-api';
import { AppShell } from '../../pages/app-shell.page';
import { avatarColour, plainAvatarColour } from '../../pages/avatar';
import { ProfilePage } from '../../pages/profile.page';
import { SignInPage } from '../../pages/sign-in.page';
import { BREAKPOINTS } from '../../pages/viewport';

test.describe('View a profile', () => {
  test('an anonymous visitor is sent to sign in, then back to the profile', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.open('profile-7');

    await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Fpeople%2Fprofile-7$/);
    await expect(new SignInPage(page).heading).toBeVisible();
  });

  test('a member sees another member’s name, featured photo, photos and roles', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addProfile({
      id: 'samuel',
      name: 'Samuel Mensah',
      homeCity: 'Toronto',
      bio: 'Backend engineer at a health-tech start-up.',
      roles: ['CreateLead', 'ProductEngineer'],
      photos: [
        photo('p1', 'Samuel speaking at Builders Night', true, '2026-10-01'),
        photo('p2', 'Teams working on laptops at the spring hackathon', false, '2026-10-05'),
      ],
    });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/samuel');

    await expect(profile.heading).toHaveText('Samuel Mensah');
    await expect(profile.roles).toHaveText(['Create Lead', 'Product Engineer']);
    await expect(profile.where('Toronto')).toBeVisible();
    await expect(profile.bio).toHaveText('Backend engineer at a health-tech start-up.');
    await expect(profile.avatarPhoto).toHaveAttribute('src', /^data:image\/svg/);
    await expect(profile.photos).toHaveCount(2);
    await expect(profile.photos.first()).toHaveAttribute(
      'alt',
      'Teams working on laptops at the spring hackathon',
    );
    await expect(profile.editProfile).toHaveCount(0);
    await axe.check();
  });

  test('your own profile offers Edit profile and asks for photos when there are none', async ({
    page,
    api,
    axe,
  }) => {
    const leah = api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
    const profile = new ProfilePage(page);
    await api.signInAs(leah, '/people/me');

    await expect(profile.heading).toHaveText('Leah Thompson');
    await expect(profile.editProfile).toHaveAttribute('href', '/people/me/edit');
    await expect(profile.noPhotos).toBeVisible();
    await expect(profile.addPhotos).toHaveAttribute('href', '/people/me/edit');
    await expect(page.getByText('No role yet')).toBeVisible();
    await axe.check();
  });

  test('the account menu links to your own profile', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const profile = new ProfilePage(page);
    await api.signInAs(grace);

    await new AppShell(page).openYourProfile('Grace Okonkwo');

    await expect(page).toHaveURL(/\/people\/me$/);
    await expect(profile.heading).toHaveText('Grace Okonkwo');
  });

  test('your avatar keeps the same colour in the top bar and on your profile', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const shell = new AppShell(page);
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/me');
    await expect(profile.heading).toHaveText('Grace Okonkwo');

    const onProfile = await avatarColour(profile.avatar);
    expect(onProfile).not.toBe(await plainAvatarColour(page));
    expect(await avatarColour(shell.yourAvatar('Grace Okonkwo'))).toBe(onProfile);
  });

  test('on a phone the account menu links to your own profile', async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS.xs);
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' }));

    await shell.openYourProfile('Grace Okonkwo');

    await expect(new ProfilePage(page).heading).toHaveText('Grace Okonkwo');
  });

  test('shows skeletons while the profile loads', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('GET', '/api/profiles/slow', async (route) => {
      await held;
      await route.fulfill({ status: 404 });
    });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/slow');

    await expect(profile.loading).toBeVisible();
    release();
    await expect(profile.notFound).toBeVisible();
  });

  test('an unknown id, such as an unlinked private contact, is not found', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/contact-tomas');

    await expect(profile.notFound).toBeVisible();
    await axe.check();
  });

  test('a load failure can be retried', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    api.addProfile({ id: 'samuel', name: 'Samuel Mensah' });
    let failures = 1;
    api.on('GET', '/api/profiles/samuel', (route) => {
      if (failures-- > 0) return route.fulfill({ status: 503 });
      return api.fallback(route);
    });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/samuel');

    await expect(profile.loadError).toBeVisible();
    await axe.check();
    await profile.tryAgain.click();
    await expect(profile.heading).toHaveText('Samuel Mensah');
  });
});

function photo(id: string, altText: string, isFeatured: boolean, day: string) {
  return { id, altText, isFeatured, url: photoUrl(), uploadedAt: `${day}T10:00:00Z` };
}
