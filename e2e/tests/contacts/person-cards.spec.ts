// Traces to: L2-060, L2-061, L2-058 AC3 (docs/detailed-designs/contacts/contact-photos)
import { expect, test } from '../../fixtures/app';
import { photoUrl } from '../../fixtures/mock-api';
import { ContactPage } from '../../pages/contact.page';
import { ContactsPage } from '../../pages/contacts.page';
import { BREAKPOINTS } from '../../pages/viewport';

test.describe('Contacts as person cards', () => {
  test('each contact is a card with its photo or initials, badge, subtitle and secondary line', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const jonah = api.addAccount({ email: 'jonah@example.org', name: 'Jonah Bell' });
    api.profiles.get(jonah.profileId)!.photos.push({
      id: 'jonah-photo',
      url: photoUrl('#16a34a', 'jonah'),
      altText: 'Jonah at the hackathon',
      isFeatured: true,
      uploadedAt: '2026-10-01T12:00:00Z',
      isStored: true,
    });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      email: 'tomas@example.org',
      organization: 'Harbour Light Shelter',
      city: 'Toronto',
      notes: [api.contacts.note('Runs IT.', 3), api.contacts.note('Wants to help.', 1)],
      photos: [api.contacts.photo('Tomás smiling outside Harbour Light Shelter')],
    });
    api.addAccount({ email: 'tomas@example.org', name: 'Tomás Ortega' });
    api.contacts.add({
      ownerId: grace.profileId,
      name: 'Kwame Asante',
      organization: 'Maple Street Church',
      city: 'Toronto',
      createdAtUtc: '2026-10-09T12:00:00Z',
    });
    api.contacts.add({
      ownerId: grace.profileId,
      name: 'Jonah B.',
      linkedProfileId: jonah.profileId,
      city: 'Hamilton',
    });
    api.contacts.add({
      ownerId: grace.profileId,
      name: 'Maria Fernanda Castillo-Rodríguez de la Vega',
      organization:
        'Greater Toronto Area Interfaith Coalition for Affordable Housing and Community Development',
      city: 'Mississauga',
    });

    await api.signInAs(grace, '/contacts');
    const contacts = new ContactsPage(page);

    const card = contacts.card('Tomás Ortega');
    await expect(card.photo).toHaveAttribute('alt', 'Tomás smiling outside Harbour Light Shelter');
    await expect(card.photo).toHaveAttribute('src', /^blob:/);
    await expect(card.badge).toHaveText('Signed up');
    await expect(card.subtitle).toHaveText('Harbour Light Shelter · Toronto');
    await expect(card.secondary).toHaveText('2 notes');
    // The private image was fetched with the lead's credentials through the contacts API (L2-058 AC3).
    expect(api.contacts.imageRequests).toContainEqual({
      path: `/api/contacts/${tomas.id}/photos/${tomas.photos[0].id}/image`,
      signedIn: true,
    });

    const kwame = contacts.card('Kwame Asante');
    await expect(kwame.photo).toHaveCount(0);
    await expect(kwame.initials).toHaveText('KA');
    await expect(kwame.badge).toContainText('Private');
    await expect(kwame.secondary).toHaveText('Added Fri 9 Oct');

    const linked = contacts.card('Jonah Bell');
    await expect(linked.badge).toHaveText('Member');
    await expect(linked.photo).toHaveAttribute('alt', 'Jonah at the hackathon');

    const long = contacts.card('Maria Fernanda Castillo-Rodríguez de la Vega');
    await expect(long.subtitle).toHaveCSS('-webkit-line-clamp', '2');
    expect(new Set(await contacts.firstRowHeights()).size).toBe(1);

    await expect(contacts.cardButtons.filter({ hasText: /connect|follow/i })).toHaveCount(0);
    await axe.check();

    await card.viewProfile.click();
    await expect(page).toHaveURL(`/contacts/${tomas.id}`);
    await expect(new ContactPage(page).heading).toHaveText('Tomás Ortega');
  });

  for (const [name, columns] of [
    ['xl', 4],
    ['lg', 4],
    ['md', 2],
    ['sm', 2],
    ['xs', 1],
  ] as const) {
    test(`the grid has ${columns} column${columns > 1 ? 's' : ''} at ${name}`, async ({
      page,
      api,
      axe,
    }) => {
      await page.setViewportSize(BREAKPOINTS[name]);
      const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
      for (const person of [
        'Abby Brooks',
        'Ben Carter',
        'Daniel Osei',
        'Lena Park',
        'Miriam Haddad',
      ]) {
        api.contacts.add({ ownerId: grace.profileId, name: person, city: 'Toronto' });
      }

      await api.signInAs(grace, '/contacts');
      const contacts = new ContactsPage(page);
      await expect(contacts.items).toHaveCount(5);

      expect(await contacts.columns()).toBe(columns);
      await axe.check();
    });
  }

  test('the list shows skeleton cards while it loads', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.contacts.add({ ownerId: grace.profileId, name: 'Kwame Asante' });
    await api.signInAs(grace, '/');
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('GET', '/api/contacts', async (route) => {
      await held;
      return api.fallback(route);
    });

    const contacts = new ContactsPage(page);
    await contacts.open();

    await expect(contacts.loadingCards).toBeVisible();
    await axe.check();
    release();
    await expect(contacts.card('Kwame Asante').root).toBeVisible();
  });
});
