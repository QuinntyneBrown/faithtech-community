import { expect, test } from '../../../e2e/fixtures/app';
import { photoUrl } from '../../../e2e/fixtures/mock-api';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { ConnectPage } from '../../../e2e/pages/connect.page';
import { ContactsPage } from '../../../e2e/pages/contacts.page';
import { InvitesPage } from '../../../e2e/pages/invites.page';
import { MyQrCodeDialog } from '../../../e2e/pages/my-qr-code.dialog';
import { VerifyEmailPage } from '../../../e2e/pages/verify-email.page';
import { Presenter, typeInto } from '../presenter';

// Journey: connect by QR code (docs/detailed-designs/invites/connect-by-qr-code, L2-080 to L2-084).
test('connect-by-qr-code', async ({ page, api }) => {
  const show = await Presenter.start(page, 'connect-by-qr-code');
  const invites = new InvitesPage(page);
  const dialog = new MyQrCodeDialog(page);
  const connect = new ConnectPage(page);
  const contacts = new ContactsPage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const profile = api.profiles.get(grace.profileId)!;
  profile.chapterId = api.chapters.named('Toronto').id;
  profile.photos = [
    {
      id: 'p1',
      url: photoUrl('#4a90d9', 'grace'),
      altText: 'Grace at Builders Night',
      isFeatured: true,
      uploadedAt: '2026-10-01T12:00:00Z',
    },
  ];
  const link = api.connect.addLink(grace.profileId);

  await show.card(
    'opening',
    'opening',
    ['Connect by QR code', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/invites'),
  );

  await show.step('invites', async () => {
    await expect(invites.myQrCode).toBeVisible();
  });

  await show.step(
    'my-code',
    async () => {
      await invites.myQrCode.click();
      await expect(dialog.qrCode).toBeVisible();
      await expect(dialog.link).toHaveValue(new RegExp(`/meet/${link.token}$`));
    },
    { poster: true },
  );

  await show.step('download', async () => {
    const download = page.waitForEvent('download');
    await dialog.download.click();
    expect((await download).suggestedFilename()).toBe('faithtech-qr-code.png');
  });

  await show.step('scan', async () => {
    await dialog.done.click();
    await new AppShell(page).signOut('Grace Okonkwo');
    await connect.open(link.token);
    await expect(connect.heading).toHaveText('Connect with Grace');
    await expect(connect.leadMeta).toHaveText('City Lead · Toronto');
  });

  await show.step('sign-up', async () => {
    await typeInto(connect.name, 'Tomás Ortega');
    await typeInto(connect.email, 'tomas.ortega@example.org');
    await typeInto(connect.password, 'a-long-enough-passphrase');
    await connect.submit.click();
    await expect(connect.heading).toHaveText('Check your email');
  });

  await show.step('verified', async () => {
    const tomas = api.accounts.get('tomas.ortega@example.org')!;
    await new VerifyEmailPage(page).openLink(`user-${tomas.profileId}`, 'verify-token');
    await expect(page.getByRole('heading', { level: 1, name: /You’re in/ })).toBeVisible();
  });

  await show.step('contact', async () => {
    await api.signInAs(grace, '/contacts');
    await expect(contacts.item('Tomás Ortega')).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'One code that never expires',
    'Scan, sign up, verify',
    'The new member is already your contact',
  ]);
  await show.finish();
});
