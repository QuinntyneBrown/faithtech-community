import { expect, test } from '../../../e2e/fixtures/app';
import { EditProfilePage } from '../../../e2e/pages/edit-profile.page';
import { ProfilePage } from '../../../e2e/pages/profile.page';
import { Presenter, typeInto } from '../presenter';

// Journey: edit your own profile (docs/detailed-designs/profiles/edit-own-profile, L2-006).
test('edit-own-profile', async ({ page, api }) => {
  const show = await Presenter.start(page, 'edit-own-profile');
  const profile = new ProfilePage(page);
  const edit = new EditProfilePage(page);
  const leah = api.addAccount({ name: 'Leah Thompson', email: 'leah@example.org' });

  await show.card(
    'opening',
    'opening',
    ['Keep your details current', 'Recorded against a local fake API · synthetic data'],
    () => api.signInAs(leah, '/people/me'),
  );

  await show.step('open-edit', async () => {
    await expect(profile.heading).toHaveText('Leah Thompson');
    await profile.editProfile.click();
    await expect(edit.heading).toBeVisible();
    await expect(edit.name).toHaveValue('Leah Thompson');
  });

  await show.step(
    'empty-name',
    async () => {
      await edit.name.clear();
      await edit.save.click();
      await expect(edit.summary).toContainText('Fix 1 thing to save your profile');
      await expect(edit.nameError).toHaveText('Enter your name as you’d like people to see it.');
    },
    { position: 'bottom' },
  );

  await show.step(
    'fill',
    async () => {
      await typeInto(edit.name, 'Leah Thompson');
      await typeInto(edit.homeCity, 'Vancouver');
      await typeInto(edit.bio, 'Designer and volunteer. Ask me about accessible forms.');
      await edit.save.click();
    },
    { position: 'top' },
  );

  await show.step(
    'saved',
    async () => {
      await expect(edit.savedToast).toBeVisible();
    },
    { position: 'top', poster: true },
  );

  await show.step('back', async () => {
    await edit.cancel.click();
    await expect(profile.heading).toHaveText('Leah Thompson');
    await expect(profile.where('Vancouver')).toBeVisible();
    await expect(profile.bio).toHaveText('Designer and volunteer. Ask me about accessible forms.');
  });

  await show.card('closing', 'closing', [
    'Name, home city and a short bio',
    'Errors appear before anything is sent',
    'A confirmation when it is saved',
  ]);
  await show.finish();
});
