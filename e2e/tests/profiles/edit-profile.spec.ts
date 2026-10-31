// Traces to: L2-006 (docs/detailed-designs/profiles/edit-own-profile)
import { expect, test } from '../../fixtures/app';
import { EditProfilePage } from '../../pages/edit-profile.page';
import { ProfilePage } from '../../pages/profile.page';

test.describe('Edit own profile', () => {
  test('a member changes their name, home city and bio and sees a success toast', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const toronto = api.chapters.named('Toronto');
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me');
    await new ProfilePage(page).editProfile.click();

    await expect(edit.heading).toBeVisible();
    await expect(edit.name).toHaveValue('Grace Okonkwo');
    await axe.check();
    await edit.fill({
      name: 'Grace O.',
      chapter: 'Toronto',
      bio: 'City Lead for FaithTech Toronto.',
    });
    await edit.save.click();

    await expect(edit.savedToast).toBeVisible();
    expect(api.callsTo('PUT', `/api/profiles/${grace.profileId}`)[0].body).toEqual({
      name: 'Grace O.',
      chapterId: toronto.id,
      bio: 'City Lead for FaithTech Toronto.',
    });
    await axe.check();

    await edit.cancel.click();
    const profile = new ProfilePage(page);
    await expect(profile.heading).toHaveText('Grace O.');
    await expect(profile.where('Toronto')).toBeVisible();
  });

  test('the form ends with Cancel, then Save profile last, as dialog footers do', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await expect(edit.heading).toBeVisible();
    await expect(edit.actions).toHaveText(['Cancel', 'Save profile']);
  });

  test('an empty name is caught inline and nothing is saved', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.fill({ name: '' });
    await edit.save.click();

    await expect(edit.summary).toContainText('Fix 1 thing to save your profile');
    await expect(edit.summary).toBeFocused();
    await expect(edit.nameError).toHaveText('Enter your name as you’d like people to see it.');
    expect(api.callsTo('PUT', `/api/profiles/${grace.profileId}`)).toHaveLength(0);
    await axe.check();
  });

  test('a name over 100 characters and a bio over 400 are caught inline', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.fill({ name: 'a'.repeat(101), bio: 'b'.repeat(401) });
    await edit.save.click();

    await expect(edit.summary).toContainText('Fix 2 things to save your profile');
    await expect(edit.nameError).toHaveText('Use 100 characters or fewer for your name.');
    await expect(edit.bioError).toHaveText('Use 400 characters or fewer for your bio.');
    expect(api.callsTo('PUT', `/api/profiles/${grace.profileId}`)).toHaveLength(0);
  });

  test('a stored name over 100 characters is kept in full and the member is asked to shorten it', async ({
    page,
    api,
  }) => {
    const longName = 'a'.repeat(150);
    const grace = api.addAccount({ email: 'grace@example.org', name: longName });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.fill({ bio: 'Builder in Toronto.' });
    await edit.save.click();

    await expect(edit.nameError).toHaveText('Use 100 characters or fewer for your name.');
    await expect(edit.name).toHaveValue(longName);
    expect(api.callsTo('PUT', `/api/profiles/${grace.profileId}`)).toHaveLength(0);
  });

  test('the bio counts the characters left and says how many too many once over 400', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.fill({ bio: 'b'.repeat(128) });
    await expect(edit.bioCount).toHaveText('272 characters left');
    await expect(edit.bio).toHaveAccessibleDescription(/272 characters left/);

    await edit.fill({ bio: 'b'.repeat(437) });
    await expect(edit.bioCount).toHaveText('37 characters too many');
    await expect(edit.bio).toHaveValue('b'.repeat(437));
    await axe.check();
  });

  test('errors the server reports are shown on their fields', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    api.on('PUT', `/api/profiles/${grace.profileId}`, (route) =>
      route.fulfill({
        status: 400,
        json: { status: 400, errors: { Name: ['Use 100 characters or fewer for your name.'] } },
      }),
    );
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.fill({ name: 'Grace' });
    await edit.save.click();

    await expect(edit.nameError).toHaveText('Use 100 characters or fewer for your name.');
    await expect(edit.savedToast).toHaveCount(0);
  });

  test('Save is busy while the request is in flight, and a failure keeps the changes', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('PUT', `/api/profiles/${grace.profileId}`, async (route) => {
      await held;
      await route.fulfill({ status: 503 });
    });
    const austin = api.chapters.named('Austin');
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.fill({ chapter: 'Austin' });
    await edit.save.click();

    await expect(edit.save).toHaveText(/Saving/);
    await expect(edit.save).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(edit.failedAlert).toBeVisible();
    await expect(edit.chapter).toHaveValue(austin.id);
  });

  test('shows skeletons while loading and a retryable error when loading fails', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    api.on('GET', '/api/profiles/me', async (route) => {
      calls++;
      if (calls === 1) {
        await held;
        return route.fulfill({ status: 503 });
      }
      return api.fallback(route);
    });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await expect(edit.loading).toBeVisible();
    // Checked while the request is still held, in both themes.
    await axe.check();
    await page.emulateMedia({ colorScheme: 'dark' });
    await axe.check();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(edit.loading).toBeVisible();
    release();
    await expect(edit.loadError).toBeVisible();
    await axe.check();
    await edit.tryAgain.click();
    await expect(edit.name).toHaveValue('Grace Okonkwo');
  });
});
