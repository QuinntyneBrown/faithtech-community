import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** One line of home's Recent activity (L2-049): what happened, where it links and when. */
export interface ActivityItemDto {
  id: string;
  /** The notification kind, such as "ContactSignedUp" or "InviteAccepted". */
  kind: string;
  text: string;
  /** App route of the item the activity is about. */
  linkPath: string;
  occurredAt: string;
}

/**
 * Contract for home's recent-activity feed (ADR 0016). Pages depend on ACTIVITY_SERVICE, never on
 * HttpActivityService. The feed holds only what was addressed to the caller.
 */
export interface ActivityService {
  /** The ten newest items, newest first. */
  recent(): Observable<ActivityItemDto[]>;
}

export const ACTIVITY_SERVICE = new InjectionToken<ActivityService>('ACTIVITY_SERVICE');
