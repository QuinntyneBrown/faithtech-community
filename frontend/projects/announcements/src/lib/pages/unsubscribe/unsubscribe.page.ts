import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { ANNOUNCEMENTS_SERVICE } from '@faithtech-community/api';
import {
  AuthLayoutComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  SkeletonComponent,
  StackComponent,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

type State = 'busy' | 'done' | 'invalid';

/**
 * Landing page of the unsubscribe link in announcement emails (L2-030 AC3,
 * docs/mocks/pages/unsubscribe). It needs no sign-in: the signed token is the permission.
 */
@Component({
  selector: 'ft-unsubscribe-page',
  imports: [
    AuthLayoutComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    SkeletonComponent,
    StackComponent,
  ],
  templateUrl: './unsubscribe.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnsubscribePage implements OnInit {
  private readonly announcements = inject(ANNOUNCEMENTS_SERVICE);

  /** From `?token=` through the router's input binding. */
  readonly token = input<string | undefined>();

  protected readonly state = signal<State>('busy');

  ngOnInit(): void {
    void this.unsubscribe();
  }

  private async unsubscribe(): Promise<void> {
    const token = this.token();
    if (!token) {
      this.state.set('invalid');
      return;
    }
    try {
      await firstValueFrom(this.announcements.unsubscribe(token));
      this.state.set('done');
    } catch {
      this.state.set('invalid');
    }
  }
}
