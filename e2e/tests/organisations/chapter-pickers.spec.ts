// Traces to: L2-142 AC4, L2-140 AC2 (docs/detailed-designs/organisations/chapters)
import { expect, test } from '../../fixtures/app';
import { MockApi } from '../../fixtures/mock-api';
import { NORTHSIDE } from '../../fixtures/mock-host';
import { ShareNoteDialog } from '../../pages/note.dialogs';
import { NotePage } from '../../pages/note.page';

/** Grace owns a private page; Hannah, a Communications Lead in Toronto, is someone to share it with. */
function arrange(api: MockApi) {
  const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
  const hannah = api.addAccount({
    email: 'hannah@example.org',
    name: 'Hannah Kim',
    roles: ['CommunicationsLead'],
  });
  api.profiles.get(hannah.profileId)!.chapterId = api.chapters.named('Toronto').id;
  const plan = api.notes.add({
    title: 'Q4 planning notes',
    ownerId: grace.profileId,
    blocks: [{ id: 'b', type: 'paragraph', text: [{ text: 'Budget first.' }] }],
  });
  return { grace, plan };
}

test.describe('Chapter suffixes in pickers', () => {
  // L2-142 AC4: a share picker shows "{name} · {role} · {chapter}", omitting what is missing.
  test('the share picker names a member’s role and chapter', async ({ page, api, axe }) => {
    const { grace, plan } = arrange(api);
    await api.signInAs(grace, `/notes/${plan.id}`);
    await new NotePage(page).share.click();
    const dialog = new ShareNoteDialog(page, 'Q4 planning notes');
    await dialog.visibility('Shared').check();

    const hannah = await dialog.suggestion('han', 'Hannah Kim');

    await expect(hannah).toContainText('Hannah Kim');
    await expect(hannah).toContainText('Communications Lead · Toronto');
    await axe.check();
  });

  // L2-140 AC2: with chapters off no suffix names a chapter.
  test('with chapters off the share picker shows the role alone', async ({ page, api, axe }) => {
    api.host.serve(NORTHSIDE);
    const { grace, plan } = arrange(api);
    await api.signInAs(grace, `/notes/${plan.id}`);
    await new NotePage(page).share.click();
    const dialog = new ShareNoteDialog(page, 'Q4 planning notes');
    await dialog.visibility('Shared').check();

    const hannah = await dialog.suggestion('han', 'Hannah Kim');

    await expect(hannah).toContainText('Communications Lead');
    await expect(hannah).not.toContainText('Toronto');
    await axe.check();
  });
});
