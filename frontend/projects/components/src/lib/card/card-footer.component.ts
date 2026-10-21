import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The last row of a flush card, such as "All events" under Coming up or a caption under a list
 * (`.card__footer` in the design system). Padded to line up with the list rows above it.
 */
@Component({
  selector: 'ft-card-footer',
  templateUrl: './card-footer.component.html',
  styleUrl: './card-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ft-card__footer' },
})
export class CardFooterComponent {}
