import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../button';
import { IconComponent } from '../icon';

export type ErrorKind = 'not-found' | 'forbidden' | 'server-error' | 'offline';

interface ErrorCopy {
  icon: string;
  title: string;
  text: string;
  retry: boolean;
}

const COPY: Record<ErrorKind, ErrorCopy> = {
  'not-found': {
    icon: 'search',
    title: 'We can’t find that page',
    text: 'The link may be old, or the event or contact may have been removed.',
    retry: false,
  },
  forbidden: {
    icon: 'locked',
    title: 'You don’t have access to this',
    text: 'This page needs a role you don’t have. Your City Lead can add one if you need it.',
    retry: false,
  },
  'server-error': {
    icon: 'error',
    title: 'Something went wrong on our side',
    text: 'It’s not you. We’ve been told and are looking into it. Try again in a minute.',
    retry: true,
  },
  offline: {
    icon: 'offline',
    title: 'You’re offline',
    text: 'Check your connection. Anything you were typing is still here and will save when you’re back online.',
    retry: true,
  },
};

/**
 * Full-page error: a decorative icon, the page's h1, a plain explanation and a way back. Four
 * kinds share one layout. Not found also links to search; server error shows a `reference` to
 * quote to support; server error and offline offer Try again (`retry`, busy while `retrying`).
 */
@Component({
  selector: 'ft-error-page',
  imports: [ButtonComponent, IconComponent],
  templateUrl: './error-page.component.html',
  styleUrl: './error-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPageComponent {
  readonly kind = input<ErrorKind>('not-found');
  /** Correlation ID shown on the server error page. */
  readonly reference = input<string | null>(null);
  readonly retrying = input(false);
  readonly homeHref = input('/');
  readonly searchHref = input('/search');
  /** Overrides the default heading / explanation for the kind. */
  readonly heading = input<string | null>(null);
  readonly message = input<string | null>(null);
  readonly retry = output<void>();

  protected readonly copy = computed(() => COPY[this.kind()]);
  protected readonly showReference = computed(
    () => this.kind() === 'server-error' && !!this.reference(),
  );

  protected onRetry(): void {
    if (!this.retrying()) this.retry.emit();
  }
}
