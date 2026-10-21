import { BacklogNodeDto, WorkItemKind, WorkItemStatus } from '@faithtech-community/api';
import { BadgeVariant } from '@faithtech-community/components';

/** Status names as the mocks write them. */
export const STATUS_LABELS: Record<WorkItemStatus, string> = {
  ToDo: 'To Do',
  InProgress: 'In Progress',
  Done: 'Done',
};

/** Kind badge colours from docs/mocks/pages/backlog: initiative info, epic warning, story success, task plain. */
export const KIND_BADGES: Record<WorkItemKind, BadgeVariant> = {
  Initiative: 'info',
  Epic: 'warning',
  Story: 'success',
  Task: 'role',
};

/** The deck values for story points (L2-038 AC2), without "?". */
export const POINTS = [1, 2, 3, 5, 8, 13, 21];

export function points(n: number | null): string {
  if (n === null) return 'not estimated';
  return `${n} ${n === 1 ? 'pt' : 'pts'}`;
}

export function firstName(name: string | null): string {
  return name?.split(' ')[0] ?? '';
}

/** Every node of the backlog tree, depth first. */
export function flatten(nodes: BacklogNodeDto[]): BacklogNodeDto[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}
