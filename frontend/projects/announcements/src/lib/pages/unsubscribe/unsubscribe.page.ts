import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ANNOUNCEMENTS_SERVICE } from '@faithtech-community/api';
import {
  AuthLayoutComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'working' | 'done' | 'invalid';

/**
 * The page an announcement email's unsubscribe link opens (L2-030 AC3, mock `pages/unsubscribe`). Anonymous:
 * it posts the link's signed token, so no sign-in is needed and a link scanner's GET changes nothing (ADR 0016).
 */
@Component({
  selector: 'ft-unsubscribe-page',
  imports: [AuthLayoutComponent, ButtonComponent, CardComponent, EmptyStateComponent],
  templateUrl: './unsubscribe.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnsubscribePage {
  private readonly announcements = inject(ANNOUNCEMENTS_SERVICE);

  /** The `token` query parameter of the email link. */
  readonly token = input<string>();

  protected readonly state = signal<State>('working');

  constructor() {
    effect(() => void this.unsubscribe(this.token()));
  }

  private async unsubscribe(token: string | undefined): Promise<void> {
    if (!token) {
      this.state.set('invalid');
      return;
    }
    this.state.set('working');
    try {
      await firstValueFrom(this.announcements.unsubscribe(token));
      this.state.set('done');
    } catch {
      this.state.set('invalid');
    }
  }
}
