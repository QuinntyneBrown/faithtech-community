import { Route } from '@playwright/test';

import type { MockAccount, MockProfile } from './mock-api';
import type { MockAgile } from './mock-agile';
import type { MockContacts } from './mock-contacts';
import type { MockEvents } from './mock-events';
import type { MockPartners } from './mock-partners';
import type { MockResources } from './mock-resources';
import type { MockNotes } from './mock-notes';

/** What the search fake reads from the rest of the fake backend. */
export interface SearchContext {
  readonly accounts: Map<string, MockAccount>;
  readonly profiles: Map<string, MockProfile>;
  readonly events: MockEvents;
  readonly partners: MockPartners;
  readonly contacts: MockContacts;
  readonly agile: MockAgile;
  readonly resources: MockResources;
  readonly notes: MockNotes;
}

const LEADS = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];
const LIMIT = 10;

/**
 * Plays GET /api/search (backend/src/FaithTech.Community.Api/Endpoints/SearchEndpoints.cs) with the same
 * permission rules (L2-026 AC2): people and events for everyone, partners for leads, Staff and System Admin,
 * only the caller's own active contacts, and work items in the caller's workspaces (all for Staff and System
 * Admin). Every word of the term must appear, ignoring case.
 */
export class MockSearch {
  constructor(private readonly context: SearchContext) {}

  handle(
    route: Route,
    method: string,
    url: URL,
    caller: MockAccount | null,
  ): Promise<void> | undefined {
    if (method !== 'GET' || url.pathname !== '/api/search') return undefined;
    if (!caller) return route.fulfill({ status: 401 });
    const term = (url.searchParams.get('q') ?? '').trim();
    if (term.length < 2) {
      return route.fulfill({
        status: 400,
        json: { status: 400, errors: { q: ['Type at least 2 characters to search.'] } },
      });
    }
    const words = term.toLowerCase().split(/\s+/);
    const matches = (...fields: (string | null | undefined)[]) => {
      const text = fields.filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => text.includes(w));
    };
    const item = (
      id: string,
      title: string,
      snippet: string,
      route: string,
      extra: { startsAt?: string; badge?: string } = {},
    ) => ({
      id,
      title,
      snippet,
      route,
      startsAt: extra.startsAt ?? null,
      badge: extra.badge ?? null,
    });
    const roles = caller.roles;
    const readsAll = roles.includes('Staff') || roles.includes('SystemAdmin');
    const accounts = [...this.context.accounts.values()];

    const people = [...this.context.profiles.values()]
      .filter((p) => accounts.some((a) => a.profileId === p.id && !a.suspended))
      .filter((p) => matches(p.name, p.homeCity, p.bio))
      .map((p) =>
        item(p.id, p.name, [p.homeCity, p.bio].filter(Boolean).join(' · '), `/people/${p.id}`),
      );
    const events = this.context.events.events
      .filter((e) => matches(e.title, e.description, e.city, e.venue))
      .map((e) =>
        item(e.id, e.title, [e.city, e.venue].filter(Boolean).join(' · '), `/events/${e.id}`, {
          startsAt: e.startsAt,
          badge: e.isCancelled ? 'Cancelled' : e.visibility === 'Public' ? 'Public' : undefined,
        }),
      );
    const partners =
      roles.some((r) => LEADS.includes(r)) || readsAll
        ? this.context.partners.partners
            // Merged (archived) partners are never found (L2-114 AC4).
            .filter((p) => !p.archivedAtUtc)
            .filter((p) => matches(p.name, p.offering, p.contactName, p.notes))
            .map((p) =>
              item(
                p.id,
                p.name,
                [p.contactName, p.offering].filter(Boolean).join(' · '),
                `/partners/${p.id}`,
                {
                  badge: p.stage,
                },
              ),
            )
        : [];
    const contacts =
      roles.some((r) => LEADS.includes(r)) || roles.includes('SystemAdmin')
        ? this.context.contacts.contacts
            .filter((c) => c.ownerId === caller.profileId && !c.archivedAtUtc)
            .filter((c) => matches(c.name, c.email, c.organization, c.city))
            .map((c) =>
              item(
                c.id,
                c.name,
                [c.organization, c.city].filter(Boolean).join(' · '),
                `/contacts/${c.id}`,
                {
                  badge: 'Private',
                },
              ),
            )
        : [];
    const visible = this.context.agile.workspaces.filter(
      (w) =>
        !w.isArchived &&
        (readsAll || w.ownerId === caller.profileId || w.memberIds.includes(caller.profileId)),
    );
    const workItems = this.context.agile.items
      .filter((i) => !i.isArchived && visible.some((w) => w.id === i.workspaceId))
      .filter((i) => matches(i.title, i.description))
      .map((i) => {
        const workspace = visible.find((w) => w.id === i.workspaceId)!;
        return item(
          i.id,
          i.title,
          `${i.kind} · ${workspace.name} · ${i.status}`,
          `/workspaces/${workspace.id}/items/${i.id}`,
        );
      });

    const groups = (
      [
        ['Person', people],
        ['Event', events],
        ['Partner', partners],
        ['Contact', contacts],
        ['WorkItem', workItems],
        ['Resource', this.context.resources.searchItems(words, caller)],
        ['Note', this.context.notes.searchItems(words, caller)],
      ] as const
    )
      .filter(([, items]) => items.length > 0)
      .map(([kind, items]) => ({ kind, items: items.slice(0, LIMIT) }));
    return route.fulfill({ status: 200, json: { groups } });
  }
}
