import { expect, test } from '../../../e2e/fixtures/app';
import { ContactFormPage } from '../../../e2e/pages/contact-form.page';
import { ContactPage } from '../../../e2e/pages/contact.page';
import { ContactsPage } from '../../../e2e/pages/contacts.page';
import { Presenter, typeInto } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

const DAY = 24 * 60 * 60 * 1000;

// Journey: a possible duplicate contact (docs/detailed-designs/contacts/possible-duplicate-contact,
// L2-091).
test('possible-duplicate-contact', async ({ page, api }) => {
  const show = await Presenter.start(page, 'possible-duplicate-contact');
  const contacts = new ContactsPage(page);
  const form = new ContactFormPage(page);
  const contact = new ContactPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const nadia = api.contacts.add({
    ownerId: grace.profileId,
    name: 'Nadia Petrov',
    email: 'nadia@kestrel.example',
    organization: 'Kestrel Labs',
    city: 'Toronto',
    createdAtUtc: new Date(api.now.getTime() - 15 * DAY).toISOString(),
    notes: [
      api.contacts.note('Studio director. Open to hosting a builders night.', 15),
      api.contacts.note('Site visit went well; room for 60.', 5),
    ],
  });
  api.contacts.add({
    ownerId: grace.profileId,
    name: 'Tomás Ortega',
    organization: 'Harbour Light Shelter',
    city: 'Toronto',
  });
  await api.freezeBrowserClock();

  await show.card(
    'opening',
    'opening',
    ['Catch a contact you already have', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/contacts'),
  );

  await show.step('new-contact', async () => {
    await expect(contacts.items).toHaveCount(2);
    await contacts.addContact.click();
    await expect(form.heading).toHaveText('New contact');
    await typeInto(form.name, 'Nadia Petrov');
  });

  await show.step(
    'warning',
    async () => {
      await typeInto(form.email, 'Nadia@Kestrel.example');
      await form.phone.focus();
      await expect(form.duplicateAlert).toContainText(
        'Nadia Petrov (Kestrel Labs) is in your contacts with nadia@kestrel.example',
      );
    },
    { poster: true },
  );

  await show.step('choices', async () => {
    await expect(form.openDuplicate('Nadia Petrov')).toBeVisible();
    await page.waitForTimeout(3500);
    await form.saveAsNew.scrollIntoViewIfNeeded();
    await expect(form.saveAsNew).toBeVisible();
    await page.waitForTimeout(3500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  });

  await show.step('open-existing', async () => {
    await form.openDuplicate('Nadia Petrov').click();
    await expect(page).toHaveURL(`/contacts/${nadia.id}`);
    await expect(contact.heading).toHaveText('Nadia Petrov');
    await expect(contact.notes).toHaveCount(2);
  });

  await show.card('closing', 'closing', [
    'Checked against your own contacts only',
    'Open the one you have, or save a new one',
    'The check never blocks saving',
  ]);
  await show.finish();
});
