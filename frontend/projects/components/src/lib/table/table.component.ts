import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';
import { SkeletonComponent } from '../skeleton';

export interface TableColumn {
  /** Property read from each row. */
  key: string;
  header: string;
  /** Monospaced cell text, e.g. timestamps. */
  mono?: boolean;
  /** Keep the header for assistive tech but hide it visually (action columns). */
  hideHeader?: boolean;
  /** Custom cell content; receives the row as the implicit context. */
  template?: TemplateRef<unknown>;
}

/**
 * Data table on a native table with a hidden caption, column headers and optional cell templates.
 * While `loading`, the headers stay and the body shows skeleton rows, one skeleton line per cell.
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

  protected skeletonRows(): number[] {
    return Array.from({ length: this.loadingRows() }, (_, i) => i);
  }
}
