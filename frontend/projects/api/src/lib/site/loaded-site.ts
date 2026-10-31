import { Provider, signal } from '@angular/core';

import { SITE_SERVICE, Site, SiteService } from './site.service';

/**
 * Reads GET /api/site from the page's own origin before an app starts, for an app that needs the answer to build its
 * providers: the marketing app takes its community origin and its content from it (L2-134 AC3). Null when it cannot
 * be read, so the app still starts.
 */
export async function fetchSite(url = '/api/site'): Promise<Site | null> {
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      headers: { accept: 'application/json' },
    });
    return response.ok ? ((await response.json()) as Site) : null;
  } catch {
    return null;
  }
}

/** SITE_SERVICE for an app that read its site with fetchSite before it started. */
export function provideLoadedSite(site: Site | null): Provider {
  const loaded = signal(site).asReadonly();
  const service: SiteService = { site: loaded, load: () => Promise.resolve() };
  return { provide: SITE_SERVICE, useValue: service };
}
