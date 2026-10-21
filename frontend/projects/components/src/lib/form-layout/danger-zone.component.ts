import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * Red-bordered section after a form for one destructive action. Project the
 * consequence text as content and the danger button with the `ftDangerAction` attribute.
 */
@Component({
  selector: 'ft-danger-zone',
  templateUrl: './danger-zone.component.html',
  styleUrl: './danger-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DangerZoneComponent {
  readonly heading = input.required<string>();
  protected readonly headingId = `ft-danger-zone-${nextId++}`;
}
