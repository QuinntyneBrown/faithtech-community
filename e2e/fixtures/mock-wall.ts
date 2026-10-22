import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Page, Request, Route } from '@playwright/test';

/**
 * The server's private-preview wall (PrivatePreviewGateMiddleware, ADR 0026) for the two dev servers. It renders the
 * API's own wall.html the way WallPage does, so the browser runs the real page, and answers the gate's contract:
 * locked navigations get the wall (403), anything else an empty 403, POST /__wall/unlock checks the passphrase and the
 * CSRF value, five refusals lock out, and a success sets __Secure-unlock and 303s to a local return URL.
 *
 * Every test starts as the owner who has already unlocked: the wall only stands once a test calls lock().
 * Cookies on localhost are shared between ports, as the parent-domain cookie is between www and app.
 */
export class MockWall {
  /** The owner's passphrase in the e2e suite. */
  readonly passphrase = 'correct horse battery staple';
  /**
   * Leave the browser on the submitted page, as it is while the server is still checking: the fake drops the request
   * (ERR_ABORTED), which ends the navigation without replacing the page, so the busy state stays on screen.
   */
  holdAnswers = false;
  /** Unlock submissions the fake has received. */
  submissions = 0;
  private readonly template = readFileSync(
    join(
      __dirname,
      '../../backend/src/FaithTech.Community.Api/Middleware/PrivatePreview/wall.html',
    ),
    'utf8',
  );
  private readonly tokens = new Set<string>();
  private failures = 0;

  constructor(
    private readonly page: Page,
    private readonly origins: string[],
  ) {}

  /** Puts the visitor in front of the wall on both hosts. */
  async lock(): Promise<void> {
    await this.page.route(
      (url) => this.origins.includes(url.origin),
      (route) => this.handle(route),
    );
  }

  /** Arranges a cookie the server never issued, as someone forging an unlock would. */
  async forgeUnlock(value: string): Promise<void> {
    const domain = new URL(this.origins[0]).hostname;
    await this.page
      .context()
      .addCookies([{ name: '__Secure-unlock', value, domain, path: '/', secure: true }]);
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const readOnly = method === 'GET' || method === 'HEAD';
    if (readOnly && url.pathname === '/robots.txt') {
      return route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'User-agent: *\nDisallow: /\n',
      });
    }
    if (await this.unlocked(request)) return route.fallback();
    if (method === 'POST' && url.pathname === '/__wall/unlock') return this.unlock(route);
    const origin = request.headers()['origin'];
    if (method === 'OPTIONS' && origin && this.origins.includes(origin)) return route.fallback();
    if (readOnly && (request.headers()['accept'] ?? '').includes('text/html')) {
      return this.wall(route, 'default', url.pathname + url.search, 403);
    }
    return route.fulfill({ status: 403, body: '' });
  }

  private async unlock(route: Route): Promise<void> {
    const request = route.request();
    const form = new URLSearchParams(request.postData() ?? '');
    const returnUrl = localPath(form.get('returnUrl'));
    this.submissions++;
    if (this.holdAnswers) return route.abort('aborted');
    if (this.failures >= 5) return this.wall(route, 'locked-out', returnUrl, 429);

    const csrf = (await this.page.context().cookies(request.url())).find(
      (c) => c.name === '__Host-wall',
    )?.value;
    const headers = await request.allHeaders();
    const url = new URL(request.url());
    const genuine = !!csrf && csrf === form.get('csrf') && fromThisOrigin(headers, url);
    if (!genuine || form.get('passphrase') !== this.passphrase) {
      this.failures++;
      return this.wall(route, 'invalid', returnUrl, 403);
    }

    this.failures = 0;
    const token = `w1.${Math.floor(Date.now() / 1000) + 7 * 86_400}.${randomBytes(32).toString('base64url')}`;
    this.tokens.add(token);
    return route.fulfill({
      status: 303,
      headers: {
        location: returnUrl,
        'cache-control': 'no-store',
        'set-cookie': `__Secure-unlock=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
      },
    });
  }

  private async unlocked(request: Request): Promise<boolean> {
    const cookies = await this.page.context().cookies(request.url());
    return cookies.some((c) => c.name === '__Secure-unlock' && this.tokens.has(c.value));
  }

  /** As WallPage.WriteAsync renders it: a fresh nonce and CSRF value each time. */
  private wall(
    route: Route,
    state: 'default' | 'invalid' | 'locked-out' | 'error',
    returnUrl: string,
    status: number,
  ): Promise<void> {
    const nonce = randomBytes(16).toString('base64url');
    const csrf = randomBytes(32).toString('base64url');
    const html = this.template
      .replaceAll('{{nonce}}', nonce)
      .replaceAll('{{csrf}}', csrf)
      .replaceAll('{{returnUrl}}', escapeHtml(returnUrl))
      .replaceAll(
        '{{alert}}',
        state === 'locked-out'
          ? alert('warning', 'Too many attempts', 'Wait a few minutes, then try again.')
          : state === 'error'
            ? alert('danger', 'Something went wrong', 'Try again in a moment.')
            : '',
      )
      .replaceAll(
        '{{fieldAttributes}}',
        state === 'invalid'
          ? ' aria-invalid="true" aria-describedby="passphrase-error" autofocus'
          : '',
      )
      .replaceAll(
        '{{fieldError}}',
        state === 'invalid'
          ? '<div class="field__error" id="passphrase-error">That passphrase didn’t work. Check it and try again.</div>'
          : '',
      );
    return route.fulfill({
      status,
      contentType: 'text/html; charset=utf-8',
      headers: {
        'cache-control': 'no-store',
        'content-security-policy': `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
        'x-robots-tag': 'noindex, nofollow',
        // As SecurityHeadersMiddleware sends on every response: it makes Chromium post the form with Origin: null.
        'referrer-policy': 'no-referrer',
        'set-cookie': `__Host-wall=${csrf}; Path=/; HttpOnly; Secure; SameSite=Strict`,
      },
      body: html,
    });
  }
}

const WARNING_ICON =
  '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>';

function alert(variant: string, title: string, text: string): string {
  return `<div class="alert alert--${variant}" role="alert">${WARNING_ICON}<div class="alert__body"><div class="alert__title">${title}</div><p>${text}</p></div></div>`;
}

/**
 * As PrivatePreviewGateMiddleware.IsGenuine: Sec-Fetch-Site, when sent, says same-origin, and Origin is this origin,
 * or null (Chromium's Origin under no-referrer) or missing.
 */
function fromThisOrigin(headers: Record<string, string>, url: URL): boolean {
  const site = headers['sec-fetch-site'];
  const origin = headers['origin'];
  return (
    (!site || site === 'same-origin') && (!origin || origin === 'null' || origin === url.origin)
  );
}

/** As ReturnUrls.Local: a path on this host, or "/". */
function localPath(value: string | null): string {
  return value &&
    value.length <= 2048 &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\u0000-\u001f\u007f]/.test(value)
    ? value
    : '/';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
