// Traces to: L2-116, L2-012 (docs/detailed-designs/contacts/possible-duplicate-contact)
//
// Given a lead on the contact form, when the email field loses focus (and again before save),
// then the lead's own contacts, active or archived, are checked for the same email:
// - a match shows a warning naming the contact with "Open {name}", and saving stays possible as
//   "Save as a new contact" (AC1 to AC3);
// - no match, or a match that belongs to another lead, shows nothing (AC4 to AC6);
// - a failed or slow check never blocks the save (AC7).
import { expect, test } from '../../fixtures/app';
import { ContactFormPage } from '../../pages/contact-form.page';
import { ContactPage } from '../../pages/contact.page';

const DAY = 24 * 60 * 60 * 1000;

test.describe('Possible duplicate contact', () => {
  test('a lead typing an email they already keep is warned and can open that contact', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const nadia = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Nadia Petrov',
      email: 'nadia@kestrel.example',
      organization: 'Kestrel Labs',
      createdAtUtc: new Date(api.now.getTime() - 15 * DAY).toISOString(),
      notes: [api.contacts.note('Studio director.', 15), api.contacts.note('Site visit.', 5)],
    });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.name.fill('Nadia Petrov');
    await form.email.fill('  Nadia@Kestrel.example ');
    await form.phone.focus();

    await expect(form.duplicateAlert).toHaveRole('status');
    await expect(form.duplicateAlert).toContainText('You already have a contact with this email');
    await expect(form.duplicateAlert).toContainText(
      'Nadia Petrov (Kestrel Labs) is in your contacts with nadia@kestrel.example, added Tue 6 Oct with 2 notes. Open it to add to those notes, or save this as a separate contact.',
    );
    await expect(form.saveAsNew).toBeVisible();
    await axe.check();

    await form.openDuplicate('Nadia Petrov').click();
    await expect(page).toHaveURL(`/contacts/${nadia.id}`);
    await expect(new ContactPage(page).heading).toHaveText('Nadia Petrov');
  });

  test('saving as a new contact keeps both contacts', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.contacts.add({
      ownerId: grace.profileId,
      name: 'Nadia Petrov',
      email: 'nadia@kestrel.example',
    });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.name.fill('Nadia P.');
    await form.email.fill('nadia@kestrel.example');
    await form.phone.focus();
    await expect(form.duplicateAlert).toBeVisible();
    await form.saveAsNew.click();

    await expect(new ContactPage(page).heading).toHaveText('Nadia P.');
    expect(
      api.contacts.contacts.filter((c) => c.email === 'nadia@kestrel.example').map((c) => c.name),
    ).toEqual(['Nadia Petrov', 'Nadia P.']);
  });

  test('an archived contact with the email is named as archived', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.contacts.add({
      ownerId: grace.profileId,
      name: 'Ben Carter',
      email: 'ben@example.org',
      archivedAtUtc: api.now.toISOString(),
    });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.email.fill('ben@example.org');
    await form.phone.focus();

    await expect(form.duplicateAlert).toContainText(
      'Ben Carter is in your archived contacts with ben@example.org',
    );
  });

  test('no warning shows when the lead keeps no contact with the email', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.contacts.add({ ownerId: grace.profileId, name: 'Ben Carter', email: 'ben@example.org' });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.name.fill('Kwame Asante');
    await form.email.fill('kwame@example.org');
    await form.phone.focus();

    await expect.poll(() => api.callsTo('GET', '/api/contacts/duplicates').length).toBe(1);
    await expect(form.duplicateAlert).toHaveCount(0);
    await expect(form.save).toBeVisible();
  });

  test('privacy: another lead’s contact with the same email shows no warning', async ({
    page,
    api,
  }) => {
    const marcus = api.addAccount({ email: 'marcus@example.org', roles: ['EventLead'] });
    api.contacts.add({
      ownerId: marcus.profileId,
      name: 'Kwame Asante',
      email: 'kwame@example.org',
    });
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    const answer = page.waitForResponse((r) => r.url().includes('/api/contacts/duplicates'));
    await form.email.fill('kwame@example.org');
    await form.phone.focus();

    expect((await answer).status()).toBe(204);
    await expect(form.duplicateAlert).toHaveCount(0);
  });

  test('privacy: a System Admin is checked against their own contacts only', async ({
    page,
    api,
  }) => {
    const marcus = api.addAccount({ email: 'marcus@example.org', roles: ['EventLead'] });
    api.contacts.add({
      ownerId: marcus.profileId,
      name: 'Kwame Asante',
      email: 'kwame@example.org',
    });
    const priya = api.addAccount({ email: 'priya@example.org', roles: ['SystemAdmin'] });
    api.contacts.add({ ownerId: priya.profileId, name: 'Lena Fischer', email: 'lena@example.org' });
    const form = new ContactFormPage(page);
    await api.signInAs(priya, '/contacts/new');

    await form.email.fill('kwame@example.org');
    await form.phone.focus();
    await expect.poll(() => api.callsTo('GET', '/api/contacts/duplicates').length).toBe(1);
    await expect(form.duplicateAlert).toHaveCount(0);

    await form.email.fill('lena@example.org');
    await form.phone.focus();
    await expect(form.duplicateAlert).toContainText('Lena Fischer is in your contacts');
  });

  test('the edit form does not match the contact being edited', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      email: 'tomas@example.org',
    });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, `/contacts/${tomas.id}/edit`);

    await expect(form.email).toHaveValue('tomas@example.org');
    await form.email.focus();
    await form.phone.focus();

    await expect.poll(() => api.callsTo('GET', '/api/contacts/duplicates').length).toBe(1);
    await expect(form.duplicateAlert).toHaveCount(0);
  });

  test('saving with an unchecked email checks first and shows the warning instead', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.contacts.add({ ownerId: grace.profileId, name: 'Ben Carter', email: 'ben@example.org' });
    const form = new ContactFormPage(page);
    await api.signInAs(grace, '/contacts/new');

    await form.name.fill('Ben C.');
    await form.email.fill('ben@example.org');
    await form.email.press('Enter');

    await expect(form.duplicateAlert).toBeVisible();
    expect(api.callsTo('POST', '/api/contacts')).toHaveLength(0);
  });

  for (const outcome of ['fail', 'slow'] as const) {
    test(`a ${outcome === 'fail' ? 'failed' : 'slow'} check does not block saving`, async ({
      page,
      api,
    }) => {
      const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
      api.contacts.add({ ownerId: grace.profileId, name: 'Ben Carter', email: 'ben@example.org' });
      api.contacts.duplicateCheck = outcome;
      const form = new ContactFormPage(page);
      await api.signInAs(grace, '/contacts/new');

      await form.name.fill('Ben C.');
      await form.email.fill('ben@example.org');
      await form.email.press('Enter');

      await expect(new ContactPage(page).heading).toHaveText('Ben C.');
      expect(api.callsTo('POST', '/api/contacts')).toHaveLength(1);
    });
  }
});
