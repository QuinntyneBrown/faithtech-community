// Traces to: L2-001, L2-003, L2-044 (docs/detailed-designs/platform/accessibility;
// docs/design-system/components/form-field.html: required fields are conveyed as required,
// optional fields are marked "(optional)").
import { expect, test } from '../../fixtures/app';
import { photoUrl } from '../../fixtures/mock-api';
import { requiredStates } from '../../pages/accessibility-tree';
import { EditProfilePage } from '../../pages/edit-profile.page';
import { InvitesPage } from '../../pages/invites.page';
import { ProfilePage } from '../../pages/profile.page';
import { RoleDialog } from '../../pages/role.dialog';
import { SendInviteDialog } from '../../pages/send-invite.dialog';
import { SignInPage } from '../../pages/sign-in.page';
import { SignUpPage } from '../../pages/sign-up.page';

test.describe('Required fields', () => {
  test('sign in and sign up announce their fields as required before submitting', async ({
    page,
  }) => {
    const signIn = new SignInPage(page);
    await signIn.open();
    await expect(signIn.email).toBeVisible();
    expect(await requiredStates(page)).toMatchObject({ Email: true, Password: true });

    const signUp = new SignUpPage(page);
    await signUp.open();
    await expect(signUp.name).toBeVisible();
    expect(await requiredStates(page)).toMatchObject({
      'Full name': true,
      Email: true,
      Password: true,
    });
  });

  test('edit profile marks the name and photo descriptions required, not the optional fields', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    api.profiles.get(grace.profileId)!.photos = [
      {
        id: 'photo-0',
        url: photoUrl(),
        altText: 'Grace at Builders Night',
        isFeatured: true,
        uploadedAt: '2026-10-01T10:00:00Z',
      },
    ];
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me');
    await edit.open();
    await expect(edit.name).toHaveValue('Grace Okonkwo');

    expect(await requiredStates(page)).toMatchObject({
      Name: true,
      'Home city (optional)': false,
      'Bio (optional)': false,
      'Photo 1 description': true,
    });
  });

  test('Send invite marks Email required and the role and note not', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const invites = new InvitesPage(page);
    await api.signInAs(grace, '/invites');
    await invites.inviteSomeone.click();
    await expect(new SendInviteDialog(page).email).toBeVisible();

    expect(await requiredStates(page)).toMatchObject({
      Email: true,
      'Join with role': false,
      'Personal note (optional)': false,
    });
  });

  test('Add role announces its role choice as required', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addProfile({ id: 'jonah', name: 'Jonah Bell', roles: ['Attendee'] });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/jonah');
    await profile.addRole.click();
    await expect(new RoleDialog(page, 'Add a role for Jonah Bell').options.first()).toBeVisible();

    expect(await requiredStates(page)).toMatchObject({ Role: true });
  });
});
