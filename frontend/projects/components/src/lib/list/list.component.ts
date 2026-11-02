import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A stack of rows (`ft-list-item`): contacts, invites, events. Flush by default so it fills a card edge to edge.
 * `numbered` renders the rows in an `<ol>` (a hub's Rules or Worship songs); give each row its `number`.
 */
@Component({
  selector: 'ft-list',
  imports: [NgTemplateOutlet],
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'numbered() ? null : "list"',
    '[class.ft-list--flush]': 'flush()',
    '[class.ft-list--numbered]': 'numbered()',
    '[attr.aria-label]': 'numbered() ? null : label()',
  },
})
export class ListComponent {
  readonly flush = input(true);
  /** Accessible name of the list. */
  readonly label = input<string | null>(null);
  /** Renders an ordered list; each `ft-list-item` leads with its `number`. */
  readonly numbered = input(false, { transform: booleanAttribute });
}
