import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AUTH_SERVICE, OrganisationNames } from '@faithtech-community/api';
import {
  PageHeaderComponent,
  StackComponent,
  TabComponent,
  TabsComponent,
} from '@faithtech-community/components';
import { filter, map } from 'rxjs';

/**
 * The Organisation section at /organisation (L2-147 AC1), matching docs/mocks/pages/organisation-general: the
 * organisation's name, its host, and a tab per settings page: General, Roles and the chapters under their plural
 * label ("Chapters" while they are off), and Stages & types (L2-144).
 */
@Component({
  selector: 'ft-organisation-page',
  imports: [PageHeaderComponent, RouterOutlet, StackComponent, TabComponent, TabsComponent],
  templateUrl: './organisation.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganisationPage {
  protected readonly names = inject(OrganisationNames);
  private readonly auth = inject(AUTH_SERVICE);

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** The tab of the current page, for aria-current. */
  protected readonly tab = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    if (path.endsWith('/roles')) return 'roles';
    if (path.endsWith('/chapters')) return 'chapters';
    return path.endsWith('/taxonomies') ? 'taxonomies' : 'general';
  });

  protected readonly subtitle = computed(() => {
    const host = this.auth.currentUser()?.organisation?.host;
    return host ? `Organisation settings · ${host}` : 'Organisation settings';
  });
}
