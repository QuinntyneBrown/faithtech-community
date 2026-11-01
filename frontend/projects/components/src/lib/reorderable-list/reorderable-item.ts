import { BadgeVariant } from '../badge/badge.component';

/**
 * One row of a reorderable list: its id, the name the move buttons and announcements use, its count, and badges such
 * as a partner stage's "Initial" and its kind. `lead` goes before the title, such as an agenda row's time; `warning` is
 * a note under it that does not stop the row being saved, such as a time outside the event's.
 */
export interface ReorderableItem {
  id: string;
  title: string;
  lead?: string;
  meta?: string;
  warning?: string;
  badges?: readonly { label: string; variant?: BadgeVariant }[];
}
