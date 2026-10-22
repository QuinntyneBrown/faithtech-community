// Traces to: L2-040 AC3, AC4, L2-006 AC3, L2-041 AC1 (docs/detailed-designs/admin/admin-users-and-override)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { EditProfilePage } from '../../pages/edit-profile.page';
import { ProfilePage } from '../../pages/profile.page';

// A real 1×1 PNG, so the browser can preview what was chosen.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function addMembers(api: MockApi) {
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['SystemAdmin'],
  });
  const samuel = api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['CreateLead'],
  });
  api.profiles.get(samuel.profileId)!.homeCity = 'Toronto';
  return { priya, samuel };
}

test.describe('System Admin profile override', () => {
  test('a System Admin edits another member’s details and photos, and each change is audited', async ({
    page,
    api,
    axe,
  }) => {
    const { priya, samuel } = addMembers(api);
    const profile = new ProfilePage(page);
    const edit = new EditProfilePage(page);
    await api.signInAs(priya, `/people/${samuel.profileId}`);

    await expect(profile.editProfile).toHaveAttribute('href', `/people/${samuel.profileId}/edit`);
    await profile.editProfile.click();

    await expect(page).toHaveURL(`/people/${samuel.profileId}/edit`);
    await expect(edit.title).toHaveText('Edit Samuel Mensah’s profile');
    await expect(edit.adminNote).toBeVisible();
    await expect(edit.breadcrumb.getByRole('link', { name: 'Samuel Mensah' })).toHaveAttribute(
      'href',
      `/people/${samuel.profileId}`,
    );
    await expect(edit.name).toHaveValue('Samuel Mensah');
    await axe.check();

    await edit.fill({ name: 'Samuel K. Mensah', bio: 'Builds with hackathon teams.' });
    await edit.choosePhotos([{ name: 'team.png', mimeType: 'image/png', buffer: PNG }]);
    await edit.description(0).fill('Samuel at the whiteboard');
    await edit.save.click();
    await expect(edit.savedToast).toBeVisible();

    expect(api.callsTo('PUT', `/api/profiles/${samuel.profileId}`)).toHaveLength(1);
    expect(api.callsTo('PUT', `/api/profiles/${priya.profileId}`)).toHaveLength(0);
    expect(api.callsTo('POST', `/api/profiles/${samuel.profileId}/photos`)).toHaveLength(1);
    expect(api.profiles.get(samuel.profileId)!.name).toBe('Samuel K. Mensah');
    expect(api.profiles.get(priya.profileId)!.name).toBe('Priya Shah');
    expect(api.profiles.get(priya.profileId)!.photos).toHaveLength(0);
    expect(api.audit.map((e) => [e.action, e.actorId, e.targetId])).toEqual([
      ['profile.updated', priya.profileId, samuel.profileId],
      ['profile.photo.uploaded', priya.profileId, samuel.profileId],
    ]);

    await edit.cancel.click();
    await expect(profile.heading).toHaveText('Samuel K. Mensah');
    await expect(profile.photos).toHaveCount(1);
  });

  test('a member who is not a System Admin sees no Edit profile and a forbidden editor', async ({
    page,
    api,
    axe,
  }) => {
    const { samuel } = addMembers(api);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const profile = new ProfilePage(page);
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, `/people/${samuel.profileId}`);

    await expect(profile.heading).toHaveText('Samuel Mensah');
    await expect(profile.editProfile).toHaveCount(0);

    await edit.open(samuel.profileId);
    await expect(edit.forbidden).toBeVisible();
    await expect(edit.backToProfile).toHaveAttribute('href', `/people/${samuel.profileId}`);
    await expect(edit.name).toHaveCount(0);
    await axe.check();
    expect(api.callsTo('PUT', `/api/profiles/${samuel.profileId}`)).toHaveLength(0);
    expect(api.audit).toHaveLength(0);
  });

  test('a member still edits their own profile at me/edit', async ({ page, api }) => {
    const { samuel } = addMembers(api);
    const edit = new EditProfilePage(page);
    await api.signInAs(samuel, '/people/me/edit');

    await expect(edit.heading).toHaveText('Edit profile');
    await expect(edit.adminNote).toHaveCount(0);
    await edit.fill({ homeCity: 'Hamilton' });
    await edit.save.click();

    await expect(edit.savedToast).toBeVisible();
    expect(api.profiles.get(samuel.profileId)!.homeCity).toBe('Hamilton');
    expect(api.audit).toHaveLength(0);
  });
});
