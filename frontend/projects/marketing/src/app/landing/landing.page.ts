import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BenefitComponent,
  ButtonComponent,
  ContainerComponent,
  CtaBandComponent,
  GridComponent,
  LandingHeroComponent,
  VideoPlayerComponent,
} from '@faithtech-community/components';

const BROCHURE_TRANSCRIPT =
  'FaithTech is a community of Christians who build with technology. ' +
  'Find the builders, leads and volunteers in your city. ' +
  'RSVP to builders nights and hackathons, and bring a friend. ' +
  'Work together on projects that serve your neighbours. ' +
  'Join FaithTech Community. It’s free, and it takes a minute.';

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
    VideoPlayerComponent,
  ],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  private readonly router = inject(Router);

  /** The brochure's narration (eng/videos/brochure/script.md), shown as its transcript. */
  protected readonly transcript = BROCHURE_TRANSCRIPT;

  protected join(): void {
    void this.router.navigate([], { queryParams: { join: '' }, queryParamsHandling: 'merge' });
  }
}
