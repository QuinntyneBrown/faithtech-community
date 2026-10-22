import { expect, test } from '../../fixtures/app';
import { MarketingPage } from '../../pages/marketing.page';

// Traces to: L2-068 (docs/detailed-designs/marketing/landing-page).
test.describe('Brochure video', () => {
  test('waits for Play with a poster, controls and English captions turned on', async ({
    page,
    axe,
  }) => {
    const marketing = new MarketingPage(page);

    await marketing.open();

    await expect(marketing.video).toBeVisible();
    await expect(marketing.video).toHaveAccessibleName(/FaithTech Community in \d+ seconds/);
    const state = await marketing.videoState();
    expect(state).toMatchObject({ paused: true, autoplay: false, controls: true });
    expect(state.poster).toMatch(/brochure-poster\.jpg$/);
    expect(state.captions).toEqual([{ kind: 'captions', language: 'en', mode: 'showing' }]);
    await expect(marketing.videoCaption).toContainText('captions on');
    await axe.check();
  });

  test('is 30 seconds or less', async ({ page }) => {
    const marketing = new MarketingPage(page);

    await marketing.open();

    const seconds = await marketing.videoDuration();
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(30);
  });

  test('the transcript gives the whole narration as text', async ({ page }) => {
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.transcriptToggle.click();

    await expect(marketing.transcript).toContainText(
      'FaithTech is a community of Christians who build with technology.',
    );
    await expect(marketing.transcript).toContainText(
      'Join FaithTech Community. It’s free, and it takes a minute.',
    );
  });

  test('with reduced motion nothing moves until the visitor acts', async ({ page, axe }) => {
    const marketing = new MarketingPage(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await marketing.open();

    await expect(marketing.video).toBeVisible();
    expect((await marketing.videoState()).paused).toBe(true);
    expect(await marketing.runningAnimations()).toBe(0);
    await axe.check();
  });

  test('a video that cannot play leaves the poster, a message and the transcript', async ({
    page,
    api,
    axe,
  }) => {
    await api.breakBrochureVideo();
    const marketing = new MarketingPage(page);
    await marketing.open();

    await marketing.playVideo();

    await expect(marketing.videoUnavailable).toBeVisible();
    await expect(marketing.videoPoster).toBeVisible();
    await expect(marketing.transcript).toHaveAttribute('open', '');
    await axe.check();
  });
});
