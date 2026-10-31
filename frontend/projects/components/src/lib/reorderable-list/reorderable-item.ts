/** One row of a reorderable list: its id, the name the move buttons and announcements use, and its count. */
export interface ReorderableItem {
  id: string;
  title: string;
  meta?: string;
}
