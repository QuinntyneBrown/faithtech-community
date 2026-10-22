import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type NotificationKind =
  | 'ContactSignedUp'
  | 'EventCancelled'
  | 'EventChanged'
  | 'Invite'
  | 'InviteAccepted'
  | 'RsvpConfirmed'
  | 'RoleChanged'
  | 'WorkItemAssigned'
  | 'WorkspaceMemberAdded'
  | 'WorkspaceOwnerLostCityLead'
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
  /** The member whose action raised it, when there is one (ADR 0016). */
  actorId: string | null;
  actorName: string | null;
}

/** The caller's notifications, newest first, 50 to a page (L2-027). */
export interface NotificationPage {
  items: NotificationDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  unreadCount: number;
  hasMore: boolean;
}

export interface NotificationQuery {
  page?: number;
  unreadOnly?: boolean;
}

/** Contract for the notifications API. Pages depend on NOTIFICATIONS_SERVICE, never on HttpNotificationsService. */
export interface NotificationsService {
  /** Emits after a notification or all of them are marked read, so the top bar's bell can refresh. */
  readonly changed?: Observable<void>;
  list(query?: NotificationQuery): Observable<NotificationPage>;
  unreadCount(): Observable<number>;
  markRead(id: string): Observable<void>;
  markAllRead(): Observable<void>;
}

export const NOTIFICATIONS_SERVICE = new InjectionToken<NotificationsService>(
  'NOTIFICATIONS_SERVICE',
);
