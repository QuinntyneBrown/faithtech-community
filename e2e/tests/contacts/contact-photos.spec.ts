// Traces to: L2-068, L2-070, L2-071 (docs/detailed-designs/contacts/contact-photos)
import { expect, test } from '../../fixtures/app';
import { AppShell } from '../../pages/app-shell.page';
import {
  AddContactPhotoDialog,
  DeleteContactPhotoDialog,
  EditPhotoDescriptionDialog,
} from '../../pages/contact-photo.dialogs';
import { ContactPage } from '../../pages/contact.page';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const image = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

test.describe('A contact’s photos', () => {
  test('the owner sees the photos with their descriptions and features another one', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      photos: [
        api.contacts.photo('Tomás smiling outside Harbour Light Shelter', 0),
        api.contacts.photo('Tomás at the Harbour Light coffee morning', 1),
      ],
    });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);

    await expect(contact.photoCount).toHaveText('2 of 10');
    await expect(contact.photoItems).toHaveCount(2);
    await expect(contact.featuredPhoto()).toContainText(
      'Tomás smiling outside Harbour Light Shelter',
    );
    await expect(
      contact.photo('Tomás at the Harbour Light coffee morning').getByRole('img'),
    ).toHaveAttribute('src', /^blob:/);
    await axe.check();

    // Newest first: photo 1 is the coffee morning.
    await contact.feature(0).click();

    await expect(contact.featuredPhoto()).toContainText(
      'Tomás at the Harbour Light coffee morning',
    );
    expect(tomas.photos.find((p) => p.isFeatured)?.altText).toBe(
      'Tomás at the Harbour Light coffee morning',
    );
  });

  test('the owner adds a photo through the dialog, which asks for a description', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({ ownerId: grace.profileId, name: 'Tomás Ortega' });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);
    await expect(contact.photosSection).toContainText('No photos yet');

    await contact.addPhotos.click();
    const dialog = new AddContactPhotoDialog(page);
    await expect(dialog.dialog).toBeVisible();
    await dialog.choosePhotos([image('coffee.png')]);
    await dialog.add.click();
    await expect(dialog.error('Describe this photo.')).toBeVisible();
    expect(api.callsTo('POST', `/api/contacts/${tomas.id}/photos`)).toHaveLength(0);
    await axe.check();

    await dialog.description(0).fill('Tomás serving at the coffee morning');
    await dialog.add.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(contact.photoCount).toHaveText('1 of 10');
    await expect(contact.featuredPhoto()).toContainText('Tomás serving at the coffee morning');
    await expect(new AppShell(page).toasts).toContainText('Photo added');
  });

  test('the owner edits a description, and an empty one is refused', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      photos: [api.contacts.photo('Tomás at the coffee morning')],
    });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);

    await contact.editDescription(0).click();
    const dialog = new EditPhotoDescriptionDialog(page);
    await expect(dialog.description).toHaveValue('Tomás at the coffee morning');
    await dialog.description.fill(' ');
    await dialog.save.click();
    await expect(dialog.error('Describe this photo.')).toBeVisible();
    await axe.check();

    await dialog.description.fill('Tomás pouring coffee');
    await dialog.save.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(contact.photoItems.first()).toContainText('Tomás pouring coffee');
    expect(tomas.photos[0].altText).toBe('Tomás pouring coffee');
  });

  test('deleting asks first; deleting the featured photo features the newest remaining one', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      photos: [
        api.contacts.photo('Outside the shelter', 0),
        api.contacts.photo('At the coffee morning', 1),
        api.contacts.photo('Demoing the dashboard', 2),
      ],
    });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);
    const featuredIndex = 2; // newest first: the featured "Outside the shelter" is photo 3

    await contact.deletePhoto(featuredIndex).click();
    const dialog = new DeleteContactPhotoDialog(page);
    await expect(dialog.photo).toHaveAccessibleName('Outside the shelter');
    await axe.check();
    await dialog.cancel.click();
    await expect(contact.photoItems).toHaveCount(3);

    await contact.deletePhoto(featuredIndex).click();
    await dialog.confirm.click();

    await expect(contact.photoItems).toHaveCount(2);
    await expect(contact.featuredPhoto()).toContainText('Demoing the dashboard');
    await expect(new AppShell(page).toasts).toContainText('Photo deleted');
  });

  test('a photo saved while storage is down is shown as storing', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({ ownerId: grace.profileId, name: 'Tomás Ortega' });
    api.contacts.storageDown = true;
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);

    await contact.addPhotos.click();
    const dialog = new AddContactPhotoDialog(page);
    await dialog.choosePhotos([image('coffee.png')]);
    await dialog.description(0).fill('Tomás at the coffee morning');
    await dialog.add.click();

    await expect(contact.photosSection).toContainText(
      'Saved. It shows here once it finishes storing.',
    );
    await expect(contact.photoItems.first().getByRole('img')).toHaveCount(0);
    await axe.check();
  });

  test('ten photos disable Add photos and say why', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      photos: Array.from({ length: 10 }, (_, i) => api.contacts.photo(`Photo ${i}`, i)),
    });
    const contact = new ContactPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}`);

    await expect(contact.addPhotos).toBeDisabled();
    await expect(contact.photoLimit).toBeVisible();
    await axe.check();
  });

  test('another lead’s contact photos are not shown and their image URL answers 404', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const marcus = api.addAccount({ email: 'marcus@example.org', roles: ['EventLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      photos: [api.contacts.photo('Tomás outside the shelter')],
    });
    const contact = new ContactPage(page);
    await api.signInAs(marcus, '/');

    await contact.open(tomas.id);

    await expect(contact.notFound).toBeVisible();
    await expect(contact.photosSection).toHaveCount(0);
    const status = await page.evaluate(
      (url) => fetch(url).then((r) => r.status),
      `/api/contacts/${tomas.id}/photos/${tomas.photos[0].id}/image`,
    );
    expect([401, 404]).toContain(status);
  });
});
