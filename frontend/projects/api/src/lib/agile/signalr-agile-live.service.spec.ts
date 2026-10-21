import { TestBed } from '@angular/core/testing';
import { HubConnectionState } from '@microsoft/signalr';

import { AGILE_LIVE_SERVICE, BoardEvent } from './agile-live.service';
import { AGILE_HUB_CONNECTION, SignalRAgileLiveService } from './signalr-agile-live.service';

function fakeConnection() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  let reconnected: () => void = () => undefined;
  const connection = {
    state: HubConnectionState.Disconnected,
    start: vi.fn(async () => {
      connection.state = HubConnectionState.Connected;
    }),
    invoke: vi.fn(async () => undefined),
    on: vi.fn((name: string, handler: (...args: unknown[]) => void) => handlers.set(name, handler)),
    off: vi.fn((name: string) => handlers.delete(name)),
    onreconnected: vi.fn((handler: () => void) => (reconnected = handler)),
  };
  return {
    connection,
    push: (name: string, ...args: unknown[]) => handlers.get(name)?.(...args),
    reconnect: () => reconnected(),
    handlers,
  };
}

function setup() {
  const fake = fakeConnection();
  TestBed.configureTestingModule({
    providers: [
      { provide: AGILE_HUB_CONNECTION, useValue: () => fake.connection },
      { provide: AGILE_LIVE_SERVICE, useClass: SignalRAgileLiveService },
    ],
  });
  return { fake, live: TestBed.inject(AGILE_LIVE_SERVICE) };
}

describe('SignalRAgileLiveService', () => {
  it('starts the connection and joins the board’s group', async () => {
    const { fake, live } = setup();
    live.watchBoard('w1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.connection.start).toHaveBeenCalledTimes(1);
    expect(fake.connection.invoke).toHaveBeenCalledWith('WatchBoard', 'w1');
  });

  it('turns CardMoved into a moved event', () => {
    const { fake, live } = setup();
    const events: BoardEvent[] = [];
    live.watchBoard('w1').subscribe((e) => events.push(e));
    fake.push('CardMoved', 'i1', 'Done');
    expect(events).toEqual([{ kind: 'moved', itemId: 'i1', status: 'Done' }]);
  });

  it('rejoins after a reconnect and asks the page to resync', async () => {
    const { fake, live } = setup();
    const events: BoardEvent[] = [];
    live.watchBoard('w1').subscribe((e) => events.push(e));
    fake.reconnect();
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.connection.invoke).toHaveBeenCalledTimes(2);
    expect(events).toContainEqual({ kind: 'resync' });
  });

  it('stops listening on unsubscribe', () => {
    const { fake, live } = setup();
    live.watchBoard('w1').subscribe().unsubscribe();
    expect(fake.handlers.has('CardMoved')).toBe(false);
  });

  it('errors when the hub refuses the board', async () => {
    const { fake, live } = setup();
    fake.connection.invoke.mockRejectedValueOnce(
      new Error('You’re not a member of this workspace.'),
    );
    const errors: unknown[] = [];
    live.watchBoard('w1').subscribe({ error: (e) => errors.push(e) });
    await new Promise((r) => setTimeout(r));
    expect(errors).toHaveLength(1);
  });
});
