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
  /** The person whose action raised it, shown as the avatar; null for system notices. */
  actorName: string | null;
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
 * The caller's own notifications, newest first, 50 to a page (L2-027, ADR 0015). Pages and the shell
 * depend on NOTIFICATIONS_SERVICE, never on HttpNotificationsService.
 */
export interface NotificationsService {
  /** A page of 50, newest first; `unreadOnly` lists only unread ones (L2-027 AC5, AC6). */
  list(page?: number, unreadOnly?: boolean): Observable<NotificationPage>;
  unreadCount(): Observable<number>;
  markRead(id: string): Observable<void>;
  markAllRead(): Observable<void>;
}

export const NOTIFICATIONS_SERVICE = new InjectionToken<NotificationsService>(
  'NOTIFICATIONS_SERVICE',
);
