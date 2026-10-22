import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  ButtonComponent,
  ContainerComponent,
  SkipLinkComponent,
  TopBarComponent,
} from '@faithtech-community/components';
import { filter, map } from 'rxjs';

/**
 * The chrome around pages anyone may open without signing in, such as a public event (L2-023): the brand and
 * Sign in, which returns to the members' view of the same page (docs/mocks/pages/public-event).
 */
@Component({
  selector: 'ft-public-shell',
  imports: [RouterOutlet, ButtonComponent, ContainerComponent, SkipLinkComponent, TopBarComponent],
  templateUrl: './public-shell.component.html',
  styleUrl: './public-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicShellComponent {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** /public/events/{id} signs in to /events/{id}. */
  protected readonly signInHref = computed(() => {
    const id = /^\/public\/events\/([^/?#]+)/.exec(this.url())?.[1];
    return id ? `/sign-in?returnUrl=${encodeURIComponent(`/events/${id}`)}` : '/sign-in';
  });
}
