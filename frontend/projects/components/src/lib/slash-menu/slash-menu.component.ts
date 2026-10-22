import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SlashMenuOption {
  id: string;
  label: string;
  description?: string;
  /** A short glyph or emoji shown in the option's tile. */
  glyph?: string;
  /** A markdown shortcut that does the same, such as "##". */
  shortcut?: string;
}

/**
 * The slash menu and the page-link suggestions (design system, slash menu): a listbox the text box drives through
 * `aria-activedescendant`, so focus stays in the text while ↑ and ↓ move the active option (L2-088 AC7, L2-090
 * AC1, L2-099 AC3). Options are chosen by Enter in the text box or by a click here.
 */
@Component({
  selector: 'ft-slash-menu',
  templateUrl: './slash-menu.component.html',
  styleUrl: './slash-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlashMenuComponent {
  /** The listbox's name, "Insert a block" or "Link to a page". */
  readonly label = input.required<string>();
  /** The listbox id the text box points at with `aria-controls`. */
  readonly listId = input.required<string>();
  readonly options = input<readonly SlashMenuOption[]>([]);
  readonly active = input(0);
  readonly emptyText = input('No matches');
  readonly chosen = output<string>();

  optionId(index: number): string {
    return `${this.listId()}-${index}`;
  }
}
