// Traces to: L2-056, L2-060, L2-062, L2-064 AC2 (docs/detailed-designs/resources/list-and-find, add-and-edit)
import { expect, test } from '../../fixtures/app';
import { EditResourceDialog } from '../../pages/resource.dialogs';
import { ResourcePage } from '../../pages/resource.page';

test.describe('The resource page', () => {
  test('shows a file resource’s details, owner and Download, with Edit and Archive for its owner', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({
      email: 'grace@example.org',
      name: 'Grace Okonkwo',
      roles: ['CityLead'],
    });
    const deck = api.resources.add({
      title: 'City launch deck',
      ownerId: grace.profileId,
      type: 'deck',
      description: 'The deck we use to launch a new FaithTech city.',
      fileName: 'city-launch-deck.pptx',
      size: 25_794_970,
      tags: ['launch', 'city-team'],
    });
    await api.freezeBrowserClock();
    await api.signInAs(grace, `/resources/${deck.id}`);
    const resource = new ResourcePage(page);

    await expect(resource.heading).toHaveText('City launch deck');
    await expect(resource.breadcrumb).toContainText('Resources');
    await expect(resource.subtitle).toHaveText('Deck · added Wed 21 Oct by you');
    await expect(resource.download).toContainText('PPTX, 24.6 MB');
    await expect(resource.detail('File')).toContainText('city-launch-deck.pptx · PPTX · 24.6 MB');
    await expect(resource.detail('Visibility')).toContainText('Global — every signed-in member');
    await expect(resource.detail('Tags')).toContainText('launch, city-team');
    await expect(resource.detail('Owner')).toContainText('Grace Okonkwo (you)');
    await expect(resource.edit).toBeVisible();
    await expect(resource.archive).toBeVisible();
    await axe.check();
  });

  test('a link opens on its host in a new tab and an image shows its thumbnail', async ({
    page,
    api,
    axe,
  }) => {
    const marcus = api.addAccount({
      email: 'marcus@example.org',
      name: 'Marcus Lee',
      roles: ['EventLead'],
    });
    const samuel = api.addAccount({ email: 'samuel@example.org', roles: ['Volunteer'] });
    const link = api.resources.add({
      title: 'Judging rubric',
      ownerId: marcus.profileId,
      type: 'template',
      linkUrl: 'https://docs.google.com/d/1',
    });
    const image = api.resources.add({
      title: 'Pairing at the whiteboard',
      ownerId: marcus.profileId,
      type: 'image',
      fileName: 'pairing.jpg',
      description: 'Two builders at a whiteboard',
    });
    await api.signInAs(samuel, `/resources/${link.id}`);
    const resource = new ResourcePage(page);

    await expect(resource.openLink).toHaveAttribute('href', 'https://docs.google.com/d/1');
    await expect(resource.openLink).toHaveAttribute('rel', 'noopener');
    await expect(resource.detail('Link')).toContainText('docs.google.com (opens in a new tab)');
    await expect(
      page.getByText('If it asks you to sign in or the file has moved, ask Marcus Lee.'),
    ).toBeVisible();
    await expect(resource.edit).toHaveCount(0);
    await axe.check();

    await resource.open(image.id);
    await expect(
      resource.preview.getByRole('img', { name: 'Two builders at a whiteboard' }),
    ).toBeVisible();
  });

  test('a private resource is the owner’s alone and reads as missing to anyone else', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({ email: 'marcus@example.org', roles: ['CityLead'] });
    const budget = api.resources.add({
      title: 'Sponsor budget',
      ownerId: grace.profileId,
      visibility: 'Private',
    });
    await api.signInAs(grace, `/resources/${budget.id}`);
    const resource = new ResourcePage(page);
    await expect(resource.banner).toContainText('Only you can see this. System Admin can too');

    await api.signInAs(marcus, `/resources/${budget.id}`);
    await expect(resource.missing).toBeVisible();
    await expect(
      page.getByText('It may have been archived, or it hasn’t been shared with you.'),
    ).toBeVisible();
    await axe.check();
    await resource.browse.click();
    await expect(page).toHaveURL(/\/resources$/);
  });

  test('a System Admin sees why the owner can no longer add, and every control', async ({
    page,
    api,
    axe,
  }) => {
    const esther = api.addAccount({
      email: 'esther@example.org',
      name: 'Esther Nakamura',
      roles: [],
    });
    const priya = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    const retro = api.resources.add({
      title: 'Austin launch retro',
      ownerId: esther.profileId,
      type: 'deck',
    });
    await api.signInAs(priya, `/resources/${retro.id}`);
    const resource = new ResourcePage(page);

    await expect(resource.banner).toContainText('You’re viewing this as System Admin');
    await expect(resource.banner).toContainText(
      'Esther Nakamura no longer has the City Lead role.',
    );
    await expect(resource.transfer).toBeVisible();
    await expect(resource.edit).toBeVisible();
    await axe.check();
  });

  test('the owner edits the details and replaces the file in place', async ({ page, api, axe }) => {
    const grace = api.addAccount({
      email: 'grace@example.org',
      name: 'Grace Okonkwo',
      roles: ['CityLead'],
    });
    const deck = api.resources.add({
      title: 'City launch deck',
      ownerId: grace.profileId,
      type: 'deck',
      fileName: 'city-launch-deck.pptx',
    });
    await api.freezeBrowserClock();
    await api.signInAs(grace, `/resources/${deck.id}`);
    const resource = new ResourcePage(page);
    await resource.edit.click();
    const dialog = new EditResourceDialog(page);
    await dialog.opened();
    await expect(dialog.dialog).toContainText('Changes show for everyone who can see it.');
    await expect(dialog.title).toHaveValue('City launch deck');
    await axe.check();

    await dialog.title.fill('City launch deck v2');
    await dialog.replace.click();
    await dialog.fileInput.setInputFiles({
      name: 'city-launch-deck-v2.pptx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('PK v2'),
    });
    await expect(dialog.warning).toContainText(
      'This replaces city-launch-deck.pptx for everyone who can see it.',
    );
    await expect(dialog.dialog).toContainText('PPTX · 1 KB · new');
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(resource.heading).toHaveText('City launch deck v2');
    await expect(resource.detail('File')).toContainText('city-launch-deck-v2.pptx');
    await expect(resource.detail('Updated')).toContainText(
      'Wed 21 Oct by Grace Okonkwo — file replaced',
    );
    expect(api.resources.resources[0].id).toBe(deck.id);
  });

  test('a failed save keeps the old details and offers Try again', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const deck = api.resources.add({ title: 'City launch deck', ownerId: grace.profileId });
    api.on('PUT', `/api/resources/${deck.id}`, (route) => route.abort('failed'));
    await api.signInAs(grace, `/resources/${deck.id}`);
    const resource = new ResourcePage(page);
    await resource.edit.click();
    const dialog = new EditResourceDialog(page);

    await dialog.title.fill('Renamed');
    await dialog.save.click();

    await expect(dialog.alert).toContainText('Changes not saved');
    await expect(dialog.save).toHaveText('Try again');
    expect(api.resources.resources[0].title).toBe('City launch deck');
  });
});
