// Traces to: L2-013 AC5, L2-016 with L2-045 AC1 (docs/detailed-designs/platform/responsive-layout-and-theming)
import { expect, test } from '../../fixtures/app';
import { ArchivedContactsPage } from '../../pages/archived-contacts.page';
import { ContactFormPage } from '../../pages/contact-form.page';
import { ContactPage } from '../../pages/contact.page';
import { ContactsPage } from '../../pages/contacts.page';
import {
  BREAKPOINTS,
  BreakpointName,
  hasHorizontalScroll,
  undersizedTargets,
} from '../../pages/viewport';

for (const name of Object.keys(BREAKPOINTS) as BreakpointName[]) {
  test(`the contacts screens fit and keep 24px targets at ${name}`, async ({ page, api }) => {
    await page.setViewportSize(BREAKPOINTS[name]);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const tomas = api.contacts.add({
      ownerId: grace.profileId,
      name: 'Tomás Ortega',
      email: 'tomas.ortega@example.org',
      organization: 'Harbour Light Shelter',
      city: 'Toronto',
      notes: [api.contacts.note('Runs IT at Harbour Light Shelter.', 5)],
    });
    api.contacts.add({
      ownerId: grace.profileId,
      name: 'Ben Carter',
      city: 'Calgary',
      archivedAtUtc: '2026-10-13T12:00:00Z',
    });

    await api.signInAs(grace, '/contacts');
    const contacts = new ContactsPage(page);
    await expect(contacts.item('Tomás Ortega')).toBeVisible();
    expect(await hasHorizontalScroll(page), 'contacts').toBe(false);
    expect(await undersizedTargets(page), 'contacts').toEqual([]);

    const contact = new ContactPage(page);
    await contact.open(tomas.id);
    await expect(contact.notes).toHaveCount(1);
    expect(await hasHorizontalScroll(page), 'contact').toBe(false);
    expect(await undersizedTargets(page), 'contact').toEqual([]);

    const form = new ContactFormPage(page);
    await form.openNew();
    await expect(form.heading).toHaveText('New contact');
    expect(await hasHorizontalScroll(page), 'contact form').toBe(false);
    expect(await undersizedTargets(page), 'contact form').toEqual([]);

    const archived = new ArchivedContactsPage(page);
    await archived.open();
    await expect(archived.item('Ben Carter')).toBeVisible();
    expect(await hasHorizontalScroll(page), 'archived contacts').toBe(false);
    expect(await undersizedTargets(page), 'archived contacts').toEqual([]);
  });
}
