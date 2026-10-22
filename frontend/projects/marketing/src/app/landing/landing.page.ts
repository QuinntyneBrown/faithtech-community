import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BenefitComponent,
  ButtonComponent,
  ContainerComponent,
  CtaBandComponent,
  GridComponent,
  LandingHeroComponent,
} from '@faithtech-community/components';

/** The marketing page (L2-055), matching docs/mocks/pages/marketing. */
@Component({
  selector: 'ft-landing-page',
  imports: [
    BenefitComponent,
    ButtonComponent,
    ContainerComponent,
    CtaBandComponent,
    GridComponent,
    LandingHeroComponent,
  ],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  private readonly router = inject(Router);

  protected join(): void {
    void this.router.navigate([], { queryParams: { join: '' }, queryParamsHandling: 'merge' });
  }
}
