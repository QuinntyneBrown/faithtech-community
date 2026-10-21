import { Locator, Page } from '@playwright/test';

export class SignInPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly keepSignedIn: Locator;
  readonly submit: Locator;
  readonly alert: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly forgotPassword: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'Welcome back',
    });
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password', { exact: true });
    this.keepSignedIn = page.getByRole('switch', {
      name: 'Keep me signed in on this device',
    });
    this.submit = page.getByRole('button', { name: /Sign in|Signing in/ });
    // The form summary: role=alert for danger, role=status for warnings (design system, alert).
    this.alert = page.locator('ft-alert [role=alert], ft-alert [role=status]');
    this.emailError = fieldError(page, 'Email');
    this.passwordError = fieldError(page, 'Password');
    this.forgotPassword = page.getByRole('link', { name: 'Forgot your password?' });
  }

  /** Submits without filling anything in, so no request is made. */
  async submitEmpty(): Promise<void> {
    await this.submit.click();
  }

  async open(returnUrl?: string): Promise<void> {
    await this.page.goto(
      returnUrl ? `/sign-in?returnUrl=${encodeURIComponent(returnUrl)}` : '/sign-in',
    );
  }

  async signIn(
    email: string,
    password: string,
    options: { keepSignedIn?: boolean } = {},
  ): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    if (options.keepSignedIn) await this.keepSignedIn.check();
    const response = this.page.waitForResponse('**/api/account/sign-in');
    await this.submit.click();
    await response;
  }

  storedRefreshToken(store: 'sessionStorage' | 'localStorage'): Promise<string | null> {
    return this.page.evaluate((s) => window[s].getItem('ft.oidc.refresh'), store);
  }
}

/** The inline error of the form field labelled `label`. */
export function fieldError(page: Page, label: string): Locator {
  return page
    .locator('ft-form-field')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('ft-inline-message');
}
