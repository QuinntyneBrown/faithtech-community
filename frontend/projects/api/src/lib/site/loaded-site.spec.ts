import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSite, provideLoadedSite } from './loaded-site';
import { SITE_SERVICE, Site } from './site.service';

const NORTHSIDE: Site = {
  name: 'Northside Makers',
  shortName: 'Northside',
  chapterLabel: null,
  communityOrigin: 'https://app.northside.test',
  headline: 'Make things with your neighbours',
  brochure: null,
  footer: '© 2026 Northside Makers',
};

describe('fetchSite', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads GET /api/site from the page’s own origin before the app starts (L2-134 AC3)', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(NORTHSIDE), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    expect(await fetchSite()).toEqual(NORTHSIDE);
    expect(fetch).toHaveBeenCalledWith(
      '/api/site',
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('answers null when the site cannot be read, so the app still starts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    expect(await fetchSite()).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await fetchSite()).toBeNull();
  });
});

describe('provideLoadedSite', () => {
  it('gives SITE_SERVICE the site read before start', async () => {
    TestBed.configureTestingModule({ providers: [provideLoadedSite(NORTHSIDE)] });
    const service = TestBed.inject(SITE_SERVICE);

    await service.load();

    expect(service.site()).toEqual(NORTHSIDE);
  });
});
