// Traces to: L2-059 AC5-6, L2-060 AC8, L2-061 (docs/detailed-designs/resources/share)
import { expect, test } from '../../fixtures/app';
import { NotificationsPage } from '../../pages/notifications.page';
import { AddResourceDialog, EditResourceDialog } from '../../pages/resource.dialogs';
import { ResourcePage } from '../../pages/resource.page';
import { ResourcesPage } from '../../pages/resources.page';

test.describe('Share resources', () => {
  test('sharing with a member and a role notifies each recipient, who sees it as shared with them', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({
      email: 'grace@example.org',
      name: 'Grace Okonkwo',
      roles: ['CityLead'],
    });
    const hannah = api.addAccount({
      email: 'hannah@example.org',
      name: 'Hannah Kim',
      roles: ['CommunicationsLead'],
    });
    const samuel = api.addAccount({
      email: 'samuel@example.org',
      name: 'Samuel Mensah',
      roles: ['Volunteer'],
    });
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
    });
    await api.signInAs(grace, '/resources');
    await new ResourcesPage(page).add.click();
    const dialog = new AddResourceDialog(page);
    await dialog.choose({ name: 'partner-pitch.docx', buffer: Buffer.from('PK docx') });

    await dialog.visibility('Shared').check();
    await expect(dialog.dialog).toContainText('Everyone you add gets a notification.');
    await dialog.submit('Add and share').click();
    await expect(dialog.dialog).toContainText(
      'Choose at least one person or role, or pick another visibility.',
    );
    await dialog.sharePerson('han', 'Hannah Kim');
    await dialog.role('Volunteer').check();
    await axe.check();
    await dialog.submit('Add and share').click();
    await expect(dialog.dialog).toBeHidden();

    const pitch = api.resources.resources[0];
    expect(pitch).toMatchObject({
      visibility: 'Shared',
      memberIds: [hannah.profileId],
      roles: ['Volunteer'],
    });
    await api.signInAs(samuel, '/notifications');
    const notifications = new NotificationsPage(page);
    await notifications.open('Grace Okonkwo shared partner-pitch with you');
    const resource = new ResourcePage(page);
    await expect(resource.heading).toHaveText('partner-pitch');
    await expect(resource.banner).toContainText(
      'Grace Okonkwo shared this with everyone who has the Volunteer role. You can open and download it, but not share it on.',
    );
    await expect(resource.edit).toHaveCount(0);

    await api.signInAs(marcus, `/resources/${pitch.id}`);
    await expect(resource.missing).toBeVisible();
  });

  test('the owner sees the audience and changes who can see it', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const hannah = api.addAccount({
      email: 'hannah@example.org',
      name: 'Hannah Kim',
      roles: ['CommunicationsLead'],
    });
    api.addAccount({ email: 'v1@example.org', roles: ['Volunteer'] });
    api.addAccount({ email: 'v2@example.org', roles: ['Volunteer'] });
    const kit = api.resources.add({
      title: 'Volunteer kit',
      ownerId: grace.profileId,
      visibility: 'Shared',
      memberIds: [hannah.profileId],
      roles: ['Volunteer'],
    });
    await api.signInAs(grace, `/resources/${kit.id}`);
    const resource = new ResourcePage(page);

    await expect(resource.audience).toContainText('Everyone with the Volunteer role');
    await expect(resource.audience).toContainText('Role · 2 people today');
    await expect(resource.audience).toContainText('Hannah Kim');
    await expect(resource.detail('Visibility')).toContainText(
      'Shared — the people and roles below',
    );
    await axe.check();

    await resource.changeWhoCanSee.click();
    const dialog = new EditResourceDialog(page);
    await expect(dialog.visibility('Shared')).toBeFocused();
    await dialog.visibility('Global').check();
    await dialog.save.click();
    await expect(resource.detail('Visibility')).toContainText('Global — every signed-in member');
    await expect(resource.audience).toHaveCount(0);
  });
});
