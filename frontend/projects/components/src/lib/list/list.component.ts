import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A stack of rows (`ft-list-item`): contacts, invites, events. Flush by default so it fills a card edge to edge. */
@Component({
  selector: 'ft-list',
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'list',
    '[class.ft-list--flush]': 'flush()',
    '[attr.aria-label]': 'label()',
  },
})
export class ListComponent {
  readonly flush = input(true);
  /** Accessible name of the list. */
  readonly label = input<string | null>(null);
}
