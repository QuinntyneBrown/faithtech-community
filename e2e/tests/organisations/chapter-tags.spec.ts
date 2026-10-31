// Traces to: L2-141 AC1, AC2; L2-140 AC5 (docs/detailed-designs/organisations/chapters)
import { expect, test } from '../../fixtures/app';
import { NORTHSIDE } from '../../fixtures/mock-host';
import { EditProfilePage } from '../../pages/edit-profile.page';
import { EventFormPage } from '../../pages/event-form.page';
import { EventsPage } from '../../pages/events.page';
import { ProfilePage } from '../../pages/profile.page';

const CAMPUSES = {
  ...NORTHSIDE,
  chapterLabel: { singular: 'Campus', plural: 'Campuses' },
};

test.describe('Chapters on profiles and events', () => {
  test('a FaithTech member picks a home city and their profile shows it', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const toronto = api.chapters.named('Toronto');
    api.chapters.named('Austin');
    api.chapters.add('Regina', true);
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await expect(edit.chapter).toHaveAccessibleName(/^Home city/);
    expect(await edit.chapterOptions()).toEqual(['No home city', 'Toronto', 'Austin']);
    await axe.check();
    await edit.fill({ chapter: 'Toronto' });
    await edit.save.click();

    await expect(edit.savedToast).toBeVisible();
    expect(api.profiles.get(grace.profileId)!.chapterId).toBe(toronto.id);
    await page.goto('/people/me');
    await expect(new ProfilePage(page).where('Toronto')).toBeVisible();
  });

  test('a member keeps an archived home city until they pick another', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const regina = api.chapters.add('Regina', true);
    api.chapters.named('Toronto');
    api.profiles.get(grace.profileId)!.chapterId = regina.id;
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    expect(await edit.chapterOptions()).toEqual(['No home city', 'Toronto', 'Regina']);
    await expect(edit.chapter).toHaveValue(regina.id);
    await edit.fill({ bio: 'Still here.' });
    await edit.save.click();

    await expect(edit.savedToast).toBeVisible();
    expect(api.profiles.get(grace.profileId)!.chapterId).toBe(regina.id);
  });

  test('a lead tags one event with a city and leaves another FaithTech-wide', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    const austin = api.chapters.named('Austin');
    api.events.add({ title: 'Prayer and Planning', chapterId: null });
    const form = new EventFormPage(page);
    await api.signInAs(grace, '/events/new');

    await expect(form.chapter).toHaveAccessibleName(/^City/);
    expect(await form.chapterOptions()).toEqual(['FaithTech-wide', 'Austin']);
    await axe.check();
    await form.fill({
      title: 'Austin Builders Night',
      starts: '2026-11-06T18:30',
      ends: '2026-11-06T21:00',
      chapter: 'Austin',
      venue: 'Capital Factory',
    });
    await form.publish.click();

    await expect(page).toHaveURL(/\/events\/event-2$/);
    expect(api.events.events[1].chapterId).toBe(austin.id);
    const events = new EventsPage(page);
    await events.open();
    await expect(events.event('Austin Builders Night')).toContainText('Austin');
    await expect(events.event('Prayer and Planning')).toContainText('FaithTech-wide');
    await axe.check();
  });

  test('an organisation that calls them campuses gets campus pickers', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(CAMPUSES);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    api.chapters.named('North Campus');
    const edit = new EditProfilePage(page);
    const form = new EventFormPage(page);
    await api.signInAs(grace, '/people/me/edit');

    await expect(edit.chapter).toHaveAccessibleName(/^Home campus/);
    expect(await edit.chapterOptions()).toEqual(['No home campus', 'North Campus']);
    await axe.check();

    await form.openNew();
    await expect(form.chapter).toHaveAccessibleName(/^Campus/);
    expect(await form.chapterOptions()).toEqual(['Northside-wide', 'North Campus']);
    await axe.check();
  });

  test('with chapters off there is no picker and nothing names a chapter', async ({
    page,
    api,
    axe,
  }) => {
    api.host.serve(NORTHSIDE);
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['EventLead'] });
    api.events.add({ title: 'Makers Night' });
    const edit = new EditProfilePage(page);
    const form = new EventFormPage(page);
    await api.signInAs(grace, '/people/me/edit');

    await expect(edit.name).toBeVisible();
    await expect(edit.chapter).toHaveCount(0);
    await axe.check();

    await form.openNew();
    await expect(form.title).toBeVisible();
    await expect(form.chapter).toHaveCount(0);

    const events = new EventsPage(page);
    await events.open();
    await expect(events.event('Makers Night')).not.toContainText('-wide');
    await axe.check();
  });
});
