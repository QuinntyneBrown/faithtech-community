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

export interface Typography {
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
}

/** The size, weight, line height and letter spacing an element is painted in. */
export function typography(element: Locator): Promise<Typography> {
  return element.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
    };
  });
}

/** The typography of a bare heading (such as h1) under the design-system foundations. */
export function referenceHeading(page: Page, tag: 'h1' | 'h2'): Promise<Typography> {
  return page.evaluate((name) => {
    const probe = document.createElement(name);
    probe.textContent = 'Reference';
    document.body.append(probe);
    const s = getComputedStyle(probe);
    const result = {
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
    };
    probe.remove();
    return result;
  }, tag);
}
