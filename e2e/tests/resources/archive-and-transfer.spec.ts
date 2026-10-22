// Traces to: L2-063, L2-064 (docs/detailed-designs/resources/archive-and-transfer)
import { expect, test } from '../../fixtures/app';
import { ArchivedResourcesPage } from '../../pages/archived-resources.page';
import { ArchiveResourceDialog, TransferOwnershipDialog } from '../../pages/resource.dialogs';
import { ResourcePage } from '../../pages/resource.page';
import { ResourcesPage } from '../../pages/resources.page';

test.describe('Archive, restore and transfer resources', () => {
  test('archiving hides a resource until its owner restores it from Archived', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const deck = api.resources.add({
      title: 'City launch deck',
      ownerId: grace.profileId,
      type: 'Deck',
      fileName: 'deck.pptx',
      size: 25_794_970,
    });
    await api.freezeBrowserClock();
    await api.signInAs(grace, `/resources/${deck.id}`);
    const resource = new ResourcePage(page);
    await resource.archive.click();
    const dialog = new ArchiveResourceDialog(page);
    await dialog.opened();
    await expect(dialog.dialog).toContainText('It disappears for everyone who can see it today.');
    await expect(dialog.dialog).toContainText(
      'After Fri 20 Nov it’s deleted for good, file and all.',
    );
    await expect(dialog.cancel).toBeFocused();
    await axe.check();
    await dialog.archive.click();

    const resources = new ResourcesPage(page);
    await expect(resources.toast).toContainText('City launch deck archived');
    await expect(resources.toast).toContainText('Restore it from Archived until Fri 20 Nov.');
    await expect(resources.empty).toBeVisible();

    await resources.archived.click();
    const archived = new ArchivedResourcesPage(page);
    await expect(archived.heading).toHaveText('Archived resources');
    await expect(archived.item('City launch deck')).toContainText(
      'Deck · PPTX · 24.6 MB · archived Wed 21 Oct · deleted for good Fri 20 Nov',
    );
    await axe.check();
    await archived.restore('City launch deck').click();
    await expect(archived.toast).toContainText(
      'It’s back in Resources, with the same visibility as before.',
    );
    await expect(archived.empty).toBeVisible();
    await resources.open();
    await expect(resources.item('City launch deck')).toBeVisible();
  });

  test('the owner opening an archived resource sees when it will be deleted, and can restore it', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const old = api.resources.add({
      title: 'Sponsor budget 2026',
      ownerId: grace.profileId,
      archivedAt: '2026-10-13T12:00:00.000Z',
    });
    await api.signInAs(grace, `/resources/${old.id}`);
    const resource = new ResourcePage(page);

    await expect(resource.breadcrumb).toContainText('Archived');
    await expect(resource.banner).toContainText('Archived Tue 13 Oct');
    await expect(resource.banner).toContainText(
      'It will be deleted for good on Thu 12 Nov unless you restore it.',
    );
    await expect(resource.edit).toHaveCount(0);
    await axe.check();
    await resource.restore.click();
    await expect(resource.banner).toHaveCount(0);
  });

  test('a System Admin hands a resource to another contributor', async ({ page, api, axe }) => {
    const esther = api.addAccount({
      email: 'esther@example.org',
      name: 'Esther Nakamura',
      roles: ['CityLead'],
    });
    api.addAccount({ email: 'nadia@example.org', name: 'Nadia Osei', roles: ['CityLead'] });
    api.addAccount({ email: 'nate@example.org', name: 'Nate Volunteer', roles: ['Volunteer'] });
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const retro = api.resources.add({ title: 'Austin launch retro', ownerId: esther.profileId });
    await api.signInAs(priya, `/resources/${retro.id}`);
    const resource = new ResourcePage(page);
    await resource.transfer.click();
    const dialog = new TransferOwnershipDialog(page);
    await dialog.opened();
    await expect(dialog.dialog).toContainText(
      'Only members who can add resources are listed: leads, Staff and System Admin.',
    );

    await dialog.submit('Transfer').click();
    await expect(dialog.dialog).toContainText('Choose who should own it.');
    await dialog.owner.fill('na');
    await expect(dialog.suggestions.getByRole('option')).toHaveText([/Nadia Osei/]);
    await axe.check();
    await dialog.suggestions.getByRole('option', { name: /Nadia Osei/ }).click();
    await dialog.submit('Transfer to Nadia Osei').click();

    await expect(dialog.dialog).toBeHidden();
    await expect(resource.toast).toContainText('Nadia Osei owns Austin launch retro now.');
    await expect(resource.detail('Owner')).toContainText('Nadia Osei');
  });

  test('a lead cannot transfer, even their own resource', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const deck = api.resources.add({ title: 'City launch deck', ownerId: grace.profileId });
    await api.signInAs(grace, `/resources/${deck.id}`);

    await expect(new ResourcePage(page).transfer).toHaveCount(0);
  });
});
