# 0012. Agile live updates with SignalR

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-034 AC2, L2-038 AC2 to AC8
- Designs: `docs/detailed-designs/agile/board`, `docs/detailed-designs/agile/planning-poker`

## Context

Board moves and Planning Poker votes must reach other open viewers within 2 seconds, and a participant who loses the connection must rejoin with their vote intact. The designs chose SignalR but left the client contract name, the split between hub methods and HTTP, and the session end and expiry rules to supply. The real-time transport must stay behind an Application abstraction so handlers can be tested with fakes and without a hub.

## Decision

- One hub, `AgileHub`, is mapped at `/hubs/agile` in `FaithTech.Community.Api`. It requires authentication like every endpoint; the browser passes its access token in the `access_token` query string, which OpenIddict validation reads by default.
- The hub only joins and leaves groups: `WatchBoard(workspaceId)` and `WatchPokerSession(sessionId)`. Both ask `WorkspaceAccessPolicy` first and throw a `HubException` for an outsider, so a non-member cannot even listen (L2-038 AC7). Staff may watch.
- Every change goes over HTTP to an Application handler, which saves and then calls `IBoardNotifier` or `IPokerBroadcaster` (Application abstractions). `SignalRAgileNotifier` in the Api implements both over `IHubContext<AgileHub>`. Tests replace them with recording fakes.
- Broadcasts carry no secrets: `CardMoved(itemId, status)` to `board:{workspaceId}`; `PokerChanged(sessionId)` to `poker:{sessionId}`, after which clients re-read the session. The Planning Poker page re-reads the workspace's current session (`GET /api/workspaces/{id}/poker-sessions/current`), so it also learns when the session has ended; `GET /api/poker-sessions/{id}` serves a client that holds the session id. Both reads withhold other participants' vote values until the facilitator reveals (only "voted" or "still choosing"), and always return the caller's own vote, which is how a reconnecting participant recovers it (L2-038 AC8).
- The web app talks to the hub through `AGILE_LIVE_SERVICE` (`AgileLiveService` in `api`, implemented by `SignalRAgileLiveService` with `@microsoft/signalr` and automatic reconnect). On reconnect it re-joins its groups and the page reloads its state.
- Planning Poker sessions: a workspace has at most one open session (`409` otherwise; the start dialog shows that reason). A session completes after its last story is estimated, or when the facilitator ends it. There is no automatic expiry in v1.
- Who may act is checked before the round state: an uninvited member or Staff gets `403` whether or not votes are revealed; only a participant's late vote gets the `409` the deck explains (L2-038 AC10). A System Admin may start and run a session in any workspace as an audited override (ADR 0011).

## Consequences

- Clients stay correct even if a broadcast is missed, because each one triggers a read the server authorizes.
- Scaling the Api beyond one instance needs a SignalR backplane; that is a hosting change, not an Application change.
