import { expect, test } from '../../../e2e/fixtures/app';
import { HomePage } from '../../../e2e/pages/home.page';
import { seedHomeMock } from '../home-mock-data';
import { Presenter } from '../presenter';

test.use({ timezoneId: 'America/Toronto' });

// Journey: the home page (docs/detailed-designs/platform/home, L2-049).
test('home', async ({ page, api }) => {
  const show = await Presenter.start(page, 'home');
  const home = new HomePage(page);
  const grace = await seedHomeMock(api);

  await show.card(
    'opening',
    'opening',
    ['Your home page', 'Recorded against a local fake API · synthetic data'],
    () => api.signInAs(grace, '/'),
  );

  await show.step('greeting', async () => {
    await expect(home.heading).toHaveText('Good afternoon, Grace');
    await expect(home.subtitle).toHaveText('Wednesday 21 October · 3 events coming up');
    await expect(home.activityItems).toHaveCount(4);
  });

  await show.step(
    'coming-up',
    async () => {
      await expect(home.comingUpEvents).toHaveCount(3);
      await expect(home.comingUpEvents.nth(0)).toContainText('City Team Prayer & Planning');
      await home.comingUpLink('City Team Prayer & Planning').focus();
    },
    { poster: true },
  );

  await show.step('quick-actions', async () => {
    await expect(home.addContact).toBeVisible();
    await home.newEvent.focus();
  });

  await show.step('pipeline', async () => {
    await expect(home.stat('Lead')).toContainText('4');
    await expect(home.stat('In Funnel')).toContainText('3');
    await expect(home.stat('Confirmed')).toContainText('5');
    await home.openBoard.focus();
  });

  await show.step('activity', async () => {
    await expect(home.activityItems.nth(0)).toContainText('Tomás Ortega just joined FaithTech');
    await home.activityLink('Tomás Ortega just joined FaithTech').focus();
  });

  await show.card('closing', 'closing', [
    'Greeting and the date',
    'Coming up, quick actions and the partner pipeline',
    'Recent activity that matters to you',
  ]);
  await show.finish();
});
