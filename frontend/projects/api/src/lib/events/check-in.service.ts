import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { EventFormat } from './events.service';

/** Someone on the check-in list. `email` is a guest's, for leads and System Admins only (L2-093). */
export interface CheckInAttendeeDto {
  rsvpId: string;
  profileId: string | null;
  name: string;
  isGuest: boolean;
  isWalkIn: boolean;
  email: string | null;
  rsvpedAt: string;
  /** Null until checked in. */
  checkedInAt: string | null;
}

/**
 * The check-in page (L2-092, L2-093): every attendee in RSVP order, walk-ins last, and what the caller may do.
 * `going` counts every attendee, walk-ins included.
 */
export interface CheckInDto {
  eventId: string;
  title: string;
  startsAt: string;
  city: string;
  format: EventFormat;
  venue: string | null;
  isCancelled: boolean;
  cancellationReason: string | null;
  checkInOpensAt: string;
  isOpen: boolean;
  canEdit: boolean;
  canExport: boolean;
  going: number;
  checkedIn: number;
  walkIns: number;
  attendees: CheckInAttendeeDto[];
}

/** Someone at the door who didn't RSVP (L2-095). `checkInNow` is on by default. */
export interface WalkInRequest {
  name: string;
  email: string | null;
  checkInNow: boolean;
}

/** The walk-in's row, and whether an RSVP they already had was reused (L2-095 AC5). */
export interface WalkInResultDto {
  attendee: CheckInAttendeeDto;
  reused: boolean;
}

/**
 * Contract for check-in at the door (docs/detailed-designs/events/event-check-in). Pages depend on
 * CHECK_IN_SERVICE, never on HttpCheckInService.
 */
export interface CheckInService {
  /** Lead roles, Staff (read-only) and System Admins; 403 for everyone else. */
  getCheckIn(eventId: string): Observable<CheckInDto>;
  /** Idempotent: an attendee already checked in keeps the first time. */
  checkIn(eventId: string, rsvpId: string): Observable<CheckInAttendeeDto>;
  undoCheckIn(eventId: string, rsvpId: string): Observable<void>;
  /** 400 with field errors; a verified member's email links the row; an existing RSVP is reused. */
  addWalkIn(eventId: string, request: WalkInRequest): Observable<WalkInResultDto>;
}

export const CHECK_IN_SERVICE = new InjectionToken<CheckInService>('CHECK_IN_SERVICE');
