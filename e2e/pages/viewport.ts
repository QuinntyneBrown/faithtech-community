import { Page } from '@playwright/test';

/** One width per design-system breakpoint (docs/design-system/foundations/layout.html). */
export const BREAKPOINTS = {
  xs: { width: 375, height: 812 },
  sm: { width: 640, height: 900 },
  md: { width: 768, height: 1024 },
  lg: { width: 1024, height: 900 },
  xl: { width: 1280, height: 900 },
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

/** True when the page scrolls sideways, which no screen may do (L2-045 AC1). */
export function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/** Visible links and buttons smaller than 24x24 CSS pixels (WCAG 2.2 target size, L2-045 AC1). */
export function undersizedTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('a[href], button, input, [role="switch"]')]
      // A visually hidden checkbox is operated through its label, so the label is the target.
      .map((el) => (el.tagName === 'INPUT' && el.closest('label')) || el)
      .filter((el) => {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        // Inline links inside running text are exempt from the target size rule.
        if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return false;
        // The skip link is off screen until it is focused.
        if (box.right <= 0 || box.bottom <= 0) return false;
        return box.width < 24 || box.height < 24;
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`),
  );
}

/** The background colour the page actually paints. */
export function pageBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}
