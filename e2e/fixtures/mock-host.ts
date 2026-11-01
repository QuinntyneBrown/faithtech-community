import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Page, Route } from '@playwright/test';

type SystemPage = 'unknown-host' | 'suspended';

/** An organisation as the API answers it in GET /api/site and the organisation part of /api/me (L2-133 AC1). */
export interface MockOrganisation {
  slug: string;
  name: string;
  shortName: string;
  host: string;
  chapterLabel: { singular: string; plural: string } | null;
  /** Where event hubs send people who want to give (L2-158 AC4); none when absent. */
  givingLink?: string | null;
  givingText?: string | null;
  /** The Marketing:Sites entry of its public host, as GET /api/site answers it there (L2-134 AC3). */
  marketing: {
    headline: string;
    brochure: {
      url: string;
      posterUrl: string;
      captionsUrl: string;
      title: string;
      posterAlt: string;
    } | null;
    footer: string;
  };
}

/** FaithTech, the organisation the hosts belong to unless a test serves another (L2-151 seed). */
export const FAITHTECH: MockOrganisation = {
  slug: 'faithtech',
  name: 'FaithTech Community',
  shortName: 'FaithTech',
  host: 'app.faithtech.community',
  chapterLabel: { singular: 'City', plural: 'Cities' },
  givingLink: 'https://faithtech.com/donate',
  givingText: 'Help us build the next one.',
  marketing: {
    headline: 'Build with people who share your faith',
    brochure: {
      url: '/brochure/brochure.webm',
      posterUrl: '/brochure/brochure-poster.jpg',
      captionsUrl: '/brochure/brochure.en.vtt',
      title: 'FaithTech Community in 21 seconds',
      posterAlt: 'FaithTech builders pairing at a hackathon table',
    },
    footer: '© 2026 FaithTech',
  },
};

/** A second organisation for the specs that prove nothing names FaithTech by fixed text. */
export const NORTHSIDE: MockOrganisation = {
  slug: 'northside',
  name: 'Northside Makers',
  shortName: 'Northside',
  host: 'community.northside.test',
  chapterLabel: null,
  marketing: {
    headline: 'Make things with your neighbours',
    brochure: null,
    footer: '© 2026 Northside Makers',
  },
};

/**
 * The server's host resolution (OrganisationResolutionMiddleware, ADR 0032) for the two dev servers. It renders the
 * API's own unknown-host.html and suspended.html the way SystemPages does, so the browser runs the real pages:
 * navigations get the page (404 or 503), anything else an empty body of the same status.
 *
 * Every test starts on FaithTech's hosts; a host only stops resolving once a test calls unknown() or suspended().
 */
export class MockHost {
  private readonly templates: Record<SystemPage, string> = {
    'unknown-host': read('unknown-host.html'),
    suspended: read('suspended.html'),
  };

  /** The organisation the hosts resolve to. */
  organisation: MockOrganisation = FAITHTECH;

  constructor(
    private readonly page: Page,
    private readonly origins: string[],
  ) {}

  /** The hosts belong to `organisation` instead of FaithTech. */
  serve(organisation: MockOrganisation): void {
    this.organisation = organisation;
  }

  /**
   * GET /api/site (SiteEndpoints): the names and community origin on any host, plus the marketing content on the
   * public host; on the community host those are null, as the API answers.
   */
  site(communityOrigin: string, onPublicHost: boolean) {
    const { name, shortName, chapterLabel, marketing } = this.organisation;
    const { headline, brochure, footer } = onPublicHost
      ? marketing
      : { headline: null, brochure: null, footer: null };
    return { name, shortName, chapterLabel, communityOrigin, headline, brochure, footer };
  }

  /** The hosts map to no organisation. */
  unknown(): Promise<void> {
    return this.answerWith('unknown-host', 404);
  }

  /** The hosts belong to a suspended organisation. */
  suspended(): Promise<void> {
    return this.answerWith('suspended', 503);
  }

  /** The suspension is lifted: the hosts resolve to the organisation again on the next request (L2-150 AC3). */
  async lift(): Promise<void> {
    if (this.closed) await this.page.unroute(this.closed);
    this.closed = null;
  }

  private closed: ((url: URL) => boolean) | null = null;

  private async answerWith(systemPage: SystemPage, status: number): Promise<void> {
    this.closed = (url) => this.origins.includes(url.origin);
    await this.page.route(this.closed, (route) => this.handle(route, systemPage, status));
  }

  private handle(route: Route, systemPage: SystemPage, status: number): Promise<void> {
    const request = route.request();
    const readOnly = request.method() === 'GET' || request.method() === 'HEAD';
    const navigation = readOnly && (request.headers()['accept'] ?? '').includes('text/html');
    if (!navigation) {
      return route.fulfill({ status, headers: { 'cache-control': 'no-store' }, body: '' });
    }
    const nonce = randomBytes(16).toString('base64url');
    return route.fulfill({
      status,
      contentType: 'text/html; charset=utf-8',
      headers: {
        'cache-control': 'no-store',
        'content-security-policy': `default-src 'none'; style-src 'nonce-${nonce}'; img-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
        'referrer-policy': 'no-referrer',
      },
      body: this.templates[systemPage].replaceAll('{{nonce}}', nonce),
    });
  }
}

function read(name: string): string {
  return readFileSync(
    join(__dirname, `../../backend/src/FaithTech.Community.Api/Middleware/Organisations/${name}`),
    'utf8',
  );
}
