import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ORGANISATION_NAMES } from '../organisation-names/organisation-names';

/**
 * The mark tile for the auth screens. Named after the organisation's short name by default; pass an empty `label`
 * when a visible brand name sits next to it so the name is not read twice.
 */
@Component({
  selector: 'ft-logo-mark',
  templateUrl: './logo-mark.component.html',
  styleUrl: './logo-mark.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoMarkComponent {
  readonly label = input<string | null>(null);
  private readonly organisation = inject(ORGANISATION_NAMES);
  protected readonly name = computed(() => this.label() ?? this.organisation.shortName());
}
