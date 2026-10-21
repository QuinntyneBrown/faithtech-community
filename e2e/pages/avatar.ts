import { Locator, Page } from '@playwright/test';

/** The fill of an avatar circle as the browser paints it. */
export function avatarColour(avatar: Locator): Promise<string> {
  return avatar.evaluate((el) => getComputedStyle(el).backgroundColor);
}

/** The plain avatar's fill (--color-accent-subtle), used by people who are not members. */
export function plainAvatarColour(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.background = 'var(--color-accent-subtle)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  });
}
