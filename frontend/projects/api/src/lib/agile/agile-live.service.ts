import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { WorkItemStatus } from './agile.service';

/**
 * Something changed on a board: a card moved, or the connection came back after a drop and the page
 * should reload what it shows (L2-034 AC2, ADR 0009).
 */
export type BoardEvent =
  { kind: 'moved'; itemId: string; status: WorkItemStatus } | { kind: 'resync' };

/**
 * Live Agile updates over SignalR (ADR 0009). Pages depend on AGILE_LIVE_SERVICE, never on
 * SignalRAgileLiveService. Changes still go over HTTP through AGILE_SERVICE; this only listens.
 */
export interface AgileLiveService {
  /** Board events while subscribed. Errors when the caller may not watch the board. */
  watchBoard(workspaceId: string): Observable<BoardEvent>;
  /**
   * Emits whenever the session changed, or the connection came back, so the page re-reads it through
   * AGILE_SERVICE (L2-038 AC2, AC8). Errors when the caller may not watch.
   */
  watchPokerSession(sessionId: string): Observable<void>;
}

export const AGILE_LIVE_SERVICE = new InjectionToken<AgileLiveService>('AGILE_LIVE_SERVICE');
