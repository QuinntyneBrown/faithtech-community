import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';

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

/** Data table on a native table with a hidden caption, column headers and optional cell templates. */
@Component({
  selector: 'ft-table',
  imports: [NgTemplateOutlet],
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
}
