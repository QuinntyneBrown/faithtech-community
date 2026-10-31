import { BadgeVariant } from '../badge/badge.component';

/**
 * One row of a reorderable list: its id, the name the move buttons and announcements use, its count, and badges such
 * as a partner stage's "Initial" and its kind.
 */
export interface ReorderableItem {
  id: string;
  title: string;
  meta?: string;
  badges?: readonly { label: string; variant?: BadgeVariant }[];
}
