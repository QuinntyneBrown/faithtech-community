import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AUTH_SERVICE, OrganisationNames } from '@faithtech-community/api';
import {
  PageHeaderComponent,
  StackComponent,
  TabComponent,
  TabsComponent,
} from '@faithtech-community/components';

/**
 * The Organisation section at /organisation (L2-147 AC1), matching docs/mocks/pages/organisation-general: the
 * organisation's name, its host, and a tab per settings page. Only General exists so far.
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

  protected readonly subtitle = computed(() => {
    const host = this.auth.currentUser()?.organisation?.host;
    return host ? `Organisation settings · ${host}` : 'Organisation settings';
  });
}
