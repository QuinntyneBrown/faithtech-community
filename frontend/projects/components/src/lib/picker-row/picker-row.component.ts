import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconTileComponent } from '../icon-tile/icon-tile.component';

export type PickerRowType = 'radio' | 'checkbox';

/**
 * One choice in a choose-from-list dialog, such as Choose from Resources (design system, picker row): a native radio
 * or checkbox labelled by the row's title and meta, with a thumbnail (or an icon tile when there is none). A list
 * row: put it in an `ft-list`. Emits `changed` with the new checked state.
 */
@Component({
  selector: 'ft-picker-row',
  imports: [IconTileComponent],
  templateUrl: './picker-row.component.html',
  styleUrl: './picker-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem', '[class.ft-picker-row--checkbox]': 'type() === "checkbox"' },
})
export class PickerRowComponent {
  /** A radio picks one; a checkbox picks several. */
  readonly type = input<PickerRowType>('radio');
  readonly name = input.required<string>();
  readonly value = input.required<string>();
  readonly checked = input(false);
  /** The resource's thumbnail; without one the row shows an icon tile. */
  readonly thumbnailSrc = input<string | null>(null);
  /** The icon in the tile when there is no thumbnail. */
  readonly icon = input('document');
  readonly title = input.required<string>();
  /** The muted second line, such as "Image · JPG · Grace Okonkwo · Tue 20 Oct". */
  readonly meta = input<string | null>(null);

  readonly changed = output<boolean>();

  protected onChange(event: Event): void {
    this.changed.emit((event.target as HTMLInputElement).checked);
  }
}
