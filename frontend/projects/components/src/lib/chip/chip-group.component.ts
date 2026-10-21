import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Row of filter chips: a wrapping cluster with role="group", named by `label` ("Filter events").
 * View chips (links) belong in a labelled <nav>, not in a chip group.
 */
@Component({
  selector: 'ft-chip-group',
  templateUrl: './chip-group.component.html',
  styleUrl: './chip-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'label()',
  },
})
export class ChipGroupComponent {
  readonly label = input.required<string>();
}
