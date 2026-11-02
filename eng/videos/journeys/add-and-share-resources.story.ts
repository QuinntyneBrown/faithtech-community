import { expect, test } from '../../../e2e/fixtures/app';
import { NotificationsPage } from '../../../e2e/pages/notifications.page';
import { AddResourceDialog } from '../../../e2e/pages/resource.dialogs';
import { ResourcePage } from '../../../e2e/pages/resource.page';
import { ResourcesPage } from '../../../e2e/pages/resources.page';
import { Presenter, typeInto } from '../presenter';

// Journey: add and share resources (docs/detailed-designs/resources/add-and-edit and share, L2-057 to L2-061).
test('add-and-share-resources', async ({ page, api }) => {
  const show = await Presenter.start(page, 'add-and-share-resources');
  const resources = new ResourcesPage(page);
  const dialog = new AddResourceDialog(page);
  const resource = new ResourcePage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.addAccount({
    email: 'hannah@example.org',
    name: 'Hannah Kim',
    roles: ['CommunicationsLead'],
  });
  const samuel = api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['Volunteer'],
  });
  api.resources.add(
    {
      title: 'Volunteer training: welcome and safety',
      ownerId: grace.profileId,
      type: 'training',
      fileName: 'welcome.pdf',
      size: 3_250_586,
    },
    3,
  );

  await show.card(
    'opening',
    'opening',
    ['Add and share resources', 'Recorded against a local fake API · synthetic people and files'],
    () => api.signInAs(grace, '/resources'),
  );

  await show.step('list', async () => {
    await expect(resources.item('Volunteer training: welcome and safety')).toBeVisible();
  });

  await show.step('upload', async () => {
    await resources.add.click();
    await dialog.opened();
    await dialog.choose({ name: 'city-launch-deck.pptx', buffer: Buffer.from('PK deck') });
    await expect(dialog.title).toHaveValue('city-launch-deck');
    await expect(dialog.type).toHaveValue('deck');
  });

  await show.step('details', async () => {
    await dialog.title.fill('');
    await typeInto(dialog.title, 'City launch deck');
    await dialog.addTag('launch');
    await expect(dialog.visibility('Global')).toBeChecked();
  });

  await show.step('added', async () => {
    await dialog.submit('Add resource').click();
    await expect(dialog.dialog).toBeHidden();
    await expect(resources.toast).toContainText('City launch deck added');
    await expect(resources.item('City launch deck')).toContainText('Deck · PPTX');
  });

  await show.step('link', async () => {
    await resources.add.click();
    await dialog.opened();
    await dialog.linkTab.click();
    await typeInto(dialog.link, 'https://www.canva.com/design/1');
    await typeInto(dialog.title, 'Event poster template');
    await dialog.type.selectOption('Template');
    await dialog.submit('Add link').click();
    await expect(resources.item('Event poster template')).toContainText('Template · canva.com');
  });

  await show.step(
    'share',
    async () => {
      await resources.add.click();
      await dialog.opened();
      await dialog.choose({ name: 'partner-pitch.docx', buffer: Buffer.from('PK docx') });
      await dialog.visibility('Shared').check();
      await dialog.sharePerson('han', 'Hannah Kim');
      await dialog.role('Volunteer').check();
      await expect(dialog.dialog).toContainText('Everyone you add gets a notification.');
    },
    { poster: true },
  );

  await show.step('shared', async () => {
    await dialog.submit('Add and share').click();
    await expect(dialog.dialog).toBeHidden();
    await expect(resources.item('partner-pitch')).toBeVisible();
  });

  await show.step('recipient', async () => {
    await api.signInAs(samuel, '/notifications');
    await new NotificationsPage(page).open('Grace Okonkwo shared partner-pitch with you');
    await expect(resource.heading).toHaveText('partner-pitch');
    await expect(resource.banner).toContainText(
      'You can open and download it, but not share it on.',
    );
  });

  await show.card('closing', 'closing', [
    'Upload files or add an https link',
    'Type and title guessed from the file',
    'Private, shared with people and roles, or global',
  ]);
  await show.finish();
});
