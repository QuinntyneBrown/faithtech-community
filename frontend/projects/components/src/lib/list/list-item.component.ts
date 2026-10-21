import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One list row: optional leading slot (avatar or icon), a title that is a link when `href` is set,
 * a muted meta line and an optional trailing slot (badge). Slots: `[leading]`, `[trailing]`.
 */
@Component({
  selector: 'ft-list-item',
  templateUrl: './list-item.component.html',
  styleUrl: './list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem' },
})
export class ListItemComponent {
  readonly label = input.required<string>();
  readonly href = input<string | null>(null);
  readonly meta = input<string | null>(null);
}
