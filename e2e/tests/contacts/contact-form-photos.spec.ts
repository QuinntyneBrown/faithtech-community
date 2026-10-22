// Traces to: L2-055, L2-057 AC2 (docs/detailed-designs/contacts/contact-photos)
import { expect, test } from '../../fixtures/app';
import { ContactFormPage } from '../../pages/contact-form.page';
import { ContactPage } from '../../pages/contact.page';

// A real 1×1 PNG, so the browser can preview what the lead chose.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const image = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

test.describe('Photos on a new contact', () => {
  test('chosen photos with descriptions are saved with the contact, featured one first', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');
    await expect(form.note('No photos yet.')).toBeVisible();

    await form.name.fill('Kwame Asante');
    await form.choosePhotos([image('doors.png'), image('coffee.png')]);
    await expect(form.photoItems).toHaveCount(2);
    await expect(form.featuredPhoto()).toHaveCount(1);
    await expect(form.photoItems.first()).toContainText('Featured');
    await expect(
      form.note('Not saved yet. It uploads when you save the contact.').first(),
    ).toBeVisible();
    await form.description(0).fill('Kwame greeting guests at the church doors');
    await form.description(1).fill('Kwame pouring coffee at builders night');
    await form.feature(1).click();
    await expect(form.photoItems.nth(1)).toContainText('Featured');
    await axe.check();

    await form.save.click();

    const contact = new ContactPage(page);
    await expect(contact.heading).toHaveText('Kwame Asante');
    const saved = api.contacts.contacts.find((c) => c.name === 'Kwame Asante')!;
    const uploads = api.callsTo('POST', `/api/contacts/${saved.id}/photos`);
    expect(uploads.map((u) => u.body['altText'])).toEqual([
      'Kwame pouring coffee at builders night',
      'Kwame greeting guests at the church doors',
    ]);
    expect(saved.photos.find((p) => p.isFeatured)?.altText).toBe(
      'Kwame pouring coffee at builders night',
    );
    await expect(contact.photoFailedAlert).toHaveCount(0);
  });

  test('a chosen photo without a description blocks the save', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.name.fill('Kwame Asante');
    await form.choosePhotos([image('doors.png')]);
    await form.save.click();

    await expect(form.summary).toContainText('Describe photo 1');
    await expect(form.error('Describe this photo.')).toBeVisible();
    await expect(form.description(0)).toHaveAttribute('aria-invalid', 'true');
    await axe.check();
    expect(api.callsTo('POST', '/api/contacts')).toHaveLength(0);
  });

  test('a file of another type or over 5 MB is refused before it is added', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.choosePhotos([
      { name: 'flyer.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') },
      {
        name: 'party.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(Math.round(7.2 * 1024 * 1024)),
      },
    ]);

    await expect(
      form.note('flyer.pdf isn’t a photo we can use. Photos must be JPEG, PNG or WebP.'),
    ).toBeVisible();
    await expect(
      form.note('party.jpg is 7.2 MB. Photos can be up to 5 MB — try a smaller one.'),
    ).toBeVisible();
    await expect(form.photoItems).toHaveCount(0);
  });

  test('ten chosen photos disable Add photos and say why', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.choosePhotos(Array.from({ length: 10 }, (_, i) => image(`photo-${i}.png`)));

    await expect(form.photoItems).toHaveCount(10);
    await expect(form.addPhotos).toBeDisabled();
    await expect(form.photoLimit).toBeVisible();
    await axe.check();
  });

  test('when a photo fails to upload the contact is still saved and the page says what to add again', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');
    await form.name.fill('Tomás Ortega');
    await form.choosePhotos([image('outside.png'), image('demo.png')]);
    await form.description(0).fill('Tomás outside the shelter');
    await form.description(1).fill('Tomás demoing the dashboard');
    let uploads = 0;
    await page.route(/\/api\/contacts\/[^/]+\/photos$/, async (route) => {
      if (++uploads === 2) return route.fulfill({ status: 500 });
      return route.fallback();
    });

    await form.save.click();

    const contact = new ContactPage(page);
    await expect(contact.heading).toHaveText('Tomás Ortega');
    await expect(contact.photoFailedAlert).toContainText(
      'Tomás Ortega is saved, but 1 photo wasn’t added',
    );
    await expect(contact.photoFailedAlert).toContainText('Tomás demoing the dashboard');
    await axe.check();
  });
});
