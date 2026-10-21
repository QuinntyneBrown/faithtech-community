/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/notifications/in-app-notifications
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type NotificationKind =
  | 'ContactSignedUp'
  | 'EventCancelled'
  | 'EventChanged'
  | 'Invite'
  | 'RsvpConfirmed'
  | 'RoleChanged'
  | 'WorkItemAssigned'
  | 'WorkspaceMemberAdded'
  | 'PlanningPokerInvite'
  | 'Announcement';

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  title: string;
  /** App route to open after marking the notification read. */
  linkPath: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: NotificationDto[];
  unreadCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Contract for the notifications API. Pages depend on NOTIFICATIONS_SERVICE, never on HttpNotificationsService.
 * TODO(slice): NotificationPage and the unread-count body are undefined in the design; the refresh mechanism
 * (polling vs push) is open and will live in the feature container, not here.
 */
export interface NotificationsService {
  list(page?: number): Observable<NotificationPage>;
  unreadCount(): Observable<number>;
  markRead(id: string): Observable<void>;
  markAllRead(): Observable<void>;
}

export const NOTIFICATIONS_SERVICE = new InjectionToken<NotificationsService>(
  'NOTIFICATIONS_SERVICE',
);
