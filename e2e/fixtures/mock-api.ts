import { Page, Route } from '@playwright/test';

export interface MockAccount {
  name: string;
  email: string;
  password: string;
  verified: boolean;
  suspended: boolean;
  roles: string[];
}

type Handler = (route: Route, body: Record<string, unknown>) => Promise<void> | void;

/**
 * Plays the Community API and identity server in the browser, following the backend contracts
 * (backend/src/FaithTech.Community.Api/Endpoints). The app's real PKCE flow runs against it.
 */
export class MockApi {
  readonly accounts = new Map<string, MockAccount>();
  readonly calls: {
    method: string;
    path: string;
    body: Record<string, unknown>;
  }[] = [];
  /** Requests the fake does not implement. The fixture fails the test if any arrive (AGENTS.md). */
  readonly unrecognised: string[] = [];
  private readonly overrides = new Map<string, Handler>();
  private session: MockAccount | null = null;
  private signedIn: MockAccount | null = null;
  private failures = new Map<string, number>();

  constructor(private readonly page: Page) {}

  addAccount(account: Partial<MockAccount> & { email: string }): MockAccount {
    const full: MockAccount = {
      name: 'Grace Okonkwo',
      password: 'a-long-enough-passphrase',
      verified: true,
      suspended: false,
      roles: [],
      ...account,
    };
    this.accounts.set(full.email.toLowerCase(), full);
    return full;
  }

  /** Replaces the default behaviour of one endpoint, e.g. on('POST', '/api/account/sign-up', ...). */
  on(method: string, path: string, handler: Handler): void {
    this.overrides.set(`${method} ${path}`, handler);
  }

  /** Signs in through the app's real sign-in page and PKCE flow, then waits on the landing page. */
  async signInAs(account: MockAccount, path = '/'): Promise<void> {
    await this.page.goto(`/sign-in?returnUrl=${encodeURIComponent(path)}`);
    await this.page.getByLabel('Email').fill(account.email);
    await this.page.getByLabel('Password', { exact: true }).fill(account.password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.waitForURL((url) => url.pathname === path);
  }

  callsTo(method: string, path: string) {
    return this.calls.filter((c) => c.method === method && c.path === path);
  }

  async install(): Promise<void> {
    await this.page.route(/\/(api|connect)\//, (route) => this.handle(route));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = parseBody(request.postData(), request.headers()['content-type']);
    this.calls.push({ method, path: url.pathname, body });

    const override = this.overrides.get(`${method} ${url.pathname}`);
    if (override) return override(route, body);

    switch (`${method} ${url.pathname}`) {
      case 'POST /api/account/sign-in':
        return this.signIn(route, body);
      case 'GET /connect/authorize':
        return this.authorize(route, url);
      case 'POST /connect/token':
        return this.token(route, body);
      case 'GET /api/me':
        return this.me(route, request.headers()['authorization']);
      case 'POST /api/account/sign-out':
        this.signedIn = null;
        return route.fulfill({ status: 204 });
      case 'POST /api/account/sign-up':
      case 'POST /api/account/resend-verification':
      case 'POST /api/account/forgot-password':
        return route.fulfill({ status: 202 });
      case 'POST /api/account/verify-email':
      case 'POST /api/account/reset-password':
        return route.fulfill({ status: 200, json: {} });
      default:
        this.unrecognised.push(`${method} ${url.pathname}`);
        return route.abort('failed');
    }
  }

  private signIn(route: Route, body: Record<string, unknown>) {
    const email = String(body['email'] ?? '').toLowerCase();
    const account = this.accounts.get(email);
    const failures = this.failures.get(email) ?? 0;
    if (account && failures >= 5) return problem(route, 'locked_out');
    if (!account || account.password !== body['password']) {
      this.failures.set(email, failures + 1);
      return problem(route, 'invalid_credentials');
    }
    if (account.suspended) return problem(route, 'suspended');
    this.session = account;
    return route.fulfill({
      status: 200,
      json: { emailVerified: account.verified },
    });
  }

  private authorize(route: Route, url: URL) {
    if (!this.session) {
      const returnUrl = url.pathname + url.search;
      return route.fulfill({
        status: 302,
        headers: {
          location: `/sign-in?returnUrl=${encodeURIComponent(returnUrl)}`,
        },
      });
    }
    this.signedIn = this.session;
    const redirect = new URL(url.searchParams.get('redirect_uri')!);
    redirect.searchParams.set('code', 'authorization-code');
    redirect.searchParams.set('state', url.searchParams.get('state')!);
    return route.fulfill({
      status: 302,
      headers: { location: redirect.toString() },
    });
  }

  private token(route: Route, body: Record<string, unknown>) {
    if (body['grant_type'] === 'authorization_code' && !body['code_verifier']) {
      return route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
    }
    if (!this.signedIn) return route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
    return route.fulfill({
      status: 200,
      json: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 900,
      },
    });
  }

  private me(route: Route, authorization: string | undefined) {
    const account = this.signedIn;
    if (!account || authorization !== 'Bearer access-token') {
      return route.fulfill({ status: 401 });
    }
    return route.fulfill({
      status: 200,
      json: {
        id: '00000000-0000-0000-0000-000000000001',
        name: account.name,
        email: account.email,
        emailVerified: account.verified,
        roles: account.roles,
      },
    });
  }
}

/** Matches the problem body AccountEndpoints.SignInAsync returns. */
function problem(route: Route, code: string) {
  return route.fulfill({ status: 400, json: { status: 400, code } });
}

function parseBody(data: string | null, contentType = ''): Record<string, unknown> {
  if (!data) return {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(data));
  }
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return {};
  }
}
