import { expect, test } from '../../../e2e/fixtures/app';
import { ComposeAnnouncementPage } from '../../../e2e/pages/compose-announcement.page';
import { Presenter, typeInto } from '../presenter';

// Journey: send an announcement (docs/detailed-designs/announcements/send-announcement, L2-029).
test('send-announcement', async ({ page, api }) => {
  const show = await Presenter.start(page, 'send-announcement');
  const compose = new ComposeAnnouncementPage(page);

  const hannah = api.addAccount({
    email: 'hannah@example.org',
    name: 'Hannah Kim',
    roles: ['CommunicationsLead'],
  });
  const samuel = api.addAccount({
    email: 'samuel@example.org',
    name: 'Samuel Mensah',
    roles: ['ProductEngineer'],
  });
  api.addAccount({ email: 'ruth@example.org', name: 'Ruth Alvarez', roles: ['Volunteer'] });
  api.announcements.optedOut.add(samuel.profileId);

  await show.card(
    'opening',
    'opening',
    [
      'Tell the community something important',
      'Recorded against a local fake API · synthetic people',
    ],
    () => api.signInAs(hannah, '/announcements/new'),
  );

  await show.step('compose', async () => {
    await expect(compose.heading).toBeVisible();
    await expect(compose.send).toHaveText(/Send to 3 people/);
  });

  await show.step('errors', async () => {
    await compose.send.click();
    await expect(compose.errorSummary).toContainText('Fix 2 things to send');
  });

  await show.step('audience', async () => {
    await compose.chooseAudience('People with a role');
    await compose.chooseRole('Product Engineer');
    await expect(compose.send).toHaveText(/Send to 1 person/);
  });

  await show.step('write', async () => {
    await typeInto(compose.subject, 'November hackathon: teams are forming');
    await typeInto(compose.message, 'Team formation opens Monday.');
    await expect(compose.alsoEmail).toBeChecked();
  });

  await show.step(
    'sent',
    async () => {
      await compose.send.click();
      await expect(compose.sent).toContainText('Sent to 1 person');
      await expect(compose.sent).toContainText('1 has opted out');
    },
    { poster: true },
  );

  await show.card('closing', 'closing', [
    'Choose everyone, a role or an event',
    'See the recipient count before sending',
    'Email opt-outs respected',
  ]);
  await show.finish();
});
