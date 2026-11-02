import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  TemplateRef,
} from '@angular/core';
import { SkeletonComponent } from '../skeleton';

export interface TableColumn {
  /** Property read from each row. */
  key: string;
  header: string;
  /** Monospaced cell text, e.g. timestamps. */
  mono?: boolean;
  /** Keep the header for assistive tech but hide it visually (action columns). */
  hideHeader?: boolean;
  /** The column that names each row (a city, an event): its cells are `<th scope="row">`. */
  rowHeader?: boolean;
  /** With `stack`, the column's cells show their value alone on a phone, without the column name (a row number). */
  hideStackLabel?: boolean;
  /** Custom cell content; receives the row as the implicit context. */
  template?: TemplateRef<unknown>;
}

/**
 * Data table on a native table with a hidden caption, column headers and optional cell templates.
 * While `loading`, the headers stay and the body shows skeleton rows, one skeleton line per cell.
 * With `stack`, below 40rem each row becomes a block and each cell shows its column name above its value, so long text
 * columns never scroll sideways on a phone; the table roles are then set explicitly, as `display: block` can drop them.
 */
@Component({
  selector: 'ft-table',
  imports: [NgTemplateOutlet, SkeletonComponent],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableComponent {
  /** Names the table; shown to assistive tech only. */
  readonly caption = input.required<string>();
  readonly columns = input.required<TableColumn[]>();
  readonly rows = input<Record<string, unknown>[]>([]);
  readonly busy = input(false);
  /** Show skeleton rows in place of the data; the table is aria-busy. */
  readonly loading = input(false);
  readonly loadingRows = input(5);
  /** Below 40rem, stack each row as a block of labelled cells. */
  readonly stack = input(false, { transform: booleanAttribute });

  protected role(role: string): string | null {
    return this.stack() ? role : null;
  }

  protected stackLabel(col: TableColumn): string | null {
    return this.stack() && !col.hideStackLabel && !col.hideHeader ? col.header : null;
  }

  protected skeletonRows(): number[] {
    return Array.from({ length: this.loadingRows() }, (_, i) => i);
  }
}
