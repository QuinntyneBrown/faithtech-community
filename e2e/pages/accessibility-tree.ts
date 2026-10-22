import { Locator, Page } from '@playwright/test';

/**
 * True when the element sits in a live region (aria-live polite/assertive, role status or alert),
 * so a screen reader announces it when it appears without focus moving to it.
 */
export function isAnnounced(locator: Locator): Promise<boolean> {
  return locator.evaluate(
    (el) =>
      !!el.closest(
        '[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]',
      ),
  );
}

interface AXValue {
  value?: unknown;
}

interface AXNode {
  ignored: boolean;
  role?: AXValue;
  name?: AXValue;
  properties?: { name: string; value: AXValue }[];
}

const FIELD_ROLES = ['textbox', 'searchbox', 'combobox', 'radiogroup'];

/**
 * Every form field Chromium exposes to assistive technology, by accessible name, and whether it
 * is announced as required. Read from the browser's accessibility tree (CDP), not from attributes.
 */
export async function requiredStates(page: Page): Promise<Record<string, boolean>> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
    const fields: Record<string, boolean> = {};
    for (const node of nodes) {
      if (node.ignored || !FIELD_ROLES.includes(String(node.role?.value))) continue;
      const name = String(node.name?.value ?? '');
      if (!name) continue;
      fields[name] = !!node.properties?.find((p) => p.name === 'required')?.value.value;
    }
    return fields;
  } finally {
    await cdp.detach();
  }
}
