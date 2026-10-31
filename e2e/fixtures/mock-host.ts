import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Page, Route } from '@playwright/test';

type SystemPage = 'unknown-host' | 'suspended';

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

  constructor(
    private readonly page: Page,
    private readonly origins: string[],
  ) {}

  /** The hosts map to no organisation. */
  unknown(): Promise<void> {
    return this.answerWith('unknown-host', 404);
  }

  /** The hosts belong to a suspended organisation. */
  suspended(): Promise<void> {
    return this.answerWith('suspended', 503);
  }

  private async answerWith(systemPage: SystemPage, status: number): Promise<void> {
    await this.page.route(
      (url) => this.origins.includes(url.origin),
      (route) => this.handle(route, systemPage, status),
    );
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
