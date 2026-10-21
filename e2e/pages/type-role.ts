import { Locator, Page } from '@playwright/test';

/** The font size an element is painted in. */
export function fontSize(element: Locator): Promise<string> {
  return element.evaluate((el) => getComputedStyle(el).fontSize);
}

/** The font size a design-system type role (such as --text-h4) resolves to on this page. */
export function roleFontSize(page: Page, role: string): Promise<string> {
  return page.evaluate((token) => {
    const probe = document.createElement('span');
    probe.style.font = `var(${token})`;
    document.body.append(probe);
    const size = getComputedStyle(probe).fontSize;
    probe.remove();
    return size;
  }, role);
}
