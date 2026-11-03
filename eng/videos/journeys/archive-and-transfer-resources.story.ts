import { expect, test } from '../../../e2e/fixtures/app';
import { ArchivedResourcesPage } from '../../../e2e/pages/archived-resources.page';
import {
  ArchiveResourceDialog,
  TransferOwnershipDialog,
} from '../../../e2e/pages/resource.dialogs';
import { ResourcePage } from '../../../e2e/pages/resource.page';
import { ResourcesPage } from '../../../e2e/pages/resources.page';
import { Presenter, typeInto } from '../presenter';

// Journey: archive and transfer resources (docs/detailed-designs/resources/archive-and-transfer, L2-063, L2-064).
test('archive-and-transfer-resources', async ({ page, api }) => {
  const show = await Presenter.start(page, 'archive-and-transfer-resources');
  const resources = new ResourcesPage(page);
  const resource = new ResourcePage(page);
  const archived = new ArchivedResourcesPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const esther = api.addAccount({
    email: 'esther@example.org',
    name: 'Esther Nakamura',
    roles: ['CityLead'],
  });
  api.addAccount({ email: 'nadia@example.org', name: 'Nadia Osei', roles: ['CityLead'] });
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['SystemAdmin'],
  });
  const deck = api.resources.add({
    title: 'City launch deck',
    ownerId: grace.profileId,
    type: 'deck',
    fileName: 'deck.pptx',
    size: 25_794_970,
  });
  const retro = api.resources.add({ title: 'Austin launch retro', ownerId: esther.profileId });
  await api.freezeBrowserClock();

  await show.card(
    'opening',
    'opening',
    [
      'Archive and transfer resources',
      'Recorded against a local fake API · synthetic people and files',
    ],
    () => api.signInAs(grace, `/resources/${deck.id}`),
  );

  await show.step('resource', async () => {
    await expect(resource.heading).toHaveText('City launch deck');
    await expect(resource.archive).toBeVisible();
  });

  const archive = new ArchiveResourceDialog(page);
  await show.step('archive', async () => {
    await resource.archive.click();
    await archive.opened();
    await expect(archive.dialog).toContainText(
      'After Fri 20 Nov it’s deleted for good, file and all.',
    );
  });

  await show.step('archived', async () => {
    await archive.archive.click();
    await expect(resources.toast).toContainText('City launch deck archived');
  });

  await show.step(
    'archived-list',
    async () => {
      await resources.archived.click();
      await expect(archived.heading).toHaveText('Archived resources');
      await expect(archived.item('City launch deck')).toContainText('deleted for good Fri 20 Nov');
    },
    { poster: true },
  );

  await show.step('restore', async () => {
    await archived.restore('City launch deck').click();
    await expect(archived.toast).toContainText('It’s back in Resources');
    await resources.open();
    await expect(resources.item('City launch deck')).toBeVisible();
  });

  const transfer = new TransferOwnershipDialog(page);
  await show.step('transfer', async () => {
    await api.signInAs(priya, `/resources/${retro.id}`);
    await resource.transfer.click();
    await transfer.opened();
    await typeInto(transfer.owner, 'na');
    await transfer.suggestions.getByRole('option', { name: /Nadia Osei/ }).click();
  });

  await show.step('transferred', async () => {
    await transfer.submit('Transfer to Nadia Osei').click();
    await expect(resource.toast).toContainText('Nadia Osei owns Austin launch retro now.');
    await expect(resource.detail('Owner')).toContainText('Nadia Osei');
  });

  await show.card('closing', 'closing', [
    'Archive hides it from everyone',
    'Restore within 30 days, or it’s deleted',
    'A System Admin can hand it to another contributor',
  ]);
  await show.finish();
});
