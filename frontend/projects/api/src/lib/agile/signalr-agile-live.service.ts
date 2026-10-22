import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { Observable } from 'rxjs';

import { OidcAuthClient } from '../auth/oidc-auth-client.service';
import { API_BASE_URL } from '../config';
import { AgileLiveService, BoardEvent } from './agile-live.service';
import { WorkItemStatus } from './agile.service';

/** The subset of a SignalR connection the live service uses; tests supply a fake. */
export type AgileHubConnection = Pick<
  HubConnection,
  'state' | 'start' | 'invoke' | 'on' | 'off' | 'onreconnected'
>;

/** Builds the hub connection; the default connects to /hubs/agile beside the API with automatic reconnect. */
export const AGILE_HUB_CONNECTION = new InjectionToken<() => AgileHubConnection>(
  'AGILE_HUB_CONNECTION',
  {
    providedIn: 'root',
    factory: () => {
      const base = inject(API_BASE_URL);
      const oidc = inject(OidcAuthClient);
      return () =>
        new HubConnectionBuilder()
          .withUrl(`${base.replace(/\/api\/?$/, '')}/hubs/agile`, {
            accessTokenFactory: () => oidc.accessToken() ?? '',
          })
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Warning)
          .build();
    },
  },
);

@Injectable()
export class SignalRAgileLiveService implements AgileLiveService {
  private readonly create = inject(AGILE_HUB_CONNECTION);
  private connection: AgileHubConnection | null = null;
  private starting: Promise<void> | null = null;
  private readonly reconnectHandlers = new Set<() => void>();

  watchBoard(workspaceId: string): Observable<BoardEvent> {
    return new Observable<BoardEvent>((subscriber) => {
      const connection = this.hub();
      const moved = (itemId: string, status: WorkItemStatus) =>
        subscriber.next({ kind: 'moved', itemId, status });
      // After a dropped connection the server forgets the group, so join again and let the page reload.
      const rejoin = () =>
        void connection
          .invoke('WatchBoard', workspaceId)
          .then(() => subscriber.next({ kind: 'resync' }))
          .catch((error: unknown) => subscriber.error(error));
      connection.on('CardMoved', moved);
      this.reconnectHandlers.add(rejoin);
      this.start()
        .then(() => connection.invoke('WatchBoard', workspaceId))
        .catch((error: unknown) => subscriber.error(error));
      return () => {
        connection.off('CardMoved', moved);
        this.reconnectHandlers.delete(rejoin);
      };
    });
  }

  watchPokerSession(sessionId: string): Observable<void> {
    return new Observable<void>((subscriber) => {
      const connection = this.hub();
      const changed = (id: string) => {
        if (id === sessionId) subscriber.next();
      };
      const rejoin = () =>
        void connection
          .invoke('WatchPokerSession', sessionId)
          .then(() => subscriber.next())
          .catch((error: unknown) => subscriber.error(error));
      connection.on('PokerChanged', changed);
      this.reconnectHandlers.add(rejoin);
      this.start()
        .then(() => connection.invoke('WatchPokerSession', sessionId))
        .catch((error: unknown) => subscriber.error(error));
      return () => {
        connection.off('PokerChanged', changed);
        this.reconnectHandlers.delete(rejoin);
      };
    });
  }

  private hub(): AgileHubConnection {
    if (!this.connection) {
      this.connection = this.create();
      this.connection.onreconnected(() => this.reconnectHandlers.forEach((handler) => handler()));
    }
    return this.connection;
  }

  private start(): Promise<void> {
    const connection = this.hub();
    if (connection.state === HubConnectionState.Connected) return Promise.resolve();
    if (!this.starting || connection.state === HubConnectionState.Disconnected) {
      this.starting = connection.start();
    }
    return this.starting;
  }
}
