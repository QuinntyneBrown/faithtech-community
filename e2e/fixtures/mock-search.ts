import { Route } from '@playwright/test';

import { MockCaller } from './mock-contacts';

/** The records the search fake reads, each from the fake that owns it. */
export interface SearchContext {
  profiles(): {
    id: string;
    name: string;
    homeCity: string | null;
    bio: string | null;
    roles: string[];
  }[];
  events(): {
    id: string;
    title: string;
    description: string;
    city: string;
    venue: string | null;
    format: string;
    startsAt: string;
    visibility: string;
    isCancelled: boolean;
  }[];
  partners(): {
    id: string;
    name: string;
    offering: string | null;
    contactName: string | null;
    notes: string | null;
    stage: string;
  }[];
  contacts(): {
    id: string;
    ownerId: string;
    name: string;
    email: string | null;
    organization: string | null;
    city: string | null;
    archivedAtUtc: string | null;
  }[];
  workspaces(): {
    id: string;
    name: string;
    ownerId: string;
    memberIds: string[];
    isArchived: boolean;
  }[];
  items(): {
    id: string;
    workspaceId: string;
    kind: string;
    title: string;
    description: string;
    status: string;
    isArchived: boolean;
  }[];
}

interface Hit {
  id: string;
  title: string;
  snippet: string;
  route: string;
}

const LEAD_ROLES = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];
const PER_GROUP = 10;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * SearchEndpoints in the browser (backend Application/Search, ADR 0017): every word of the term must
 * start a word of the record, groups come in a fixed order, empty groups are left out, and each group
 * holds only what the caller may open: own active contacts, partners for leads, Staff and System
 * Admin, work items in the caller's workspaces (all of them for Staff and System Admin).
 */
export class MockSearch {
  constructor(private readonly context: SearchContext) {}

  handle(
    route: Route,
    method: string,
    url: URL,
    caller: MockCaller | null,
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
    const words = term.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const matches = (...parts: (string | null)[]) => {
      const text = ` ${parts.filter(Boolean).join(' ').toLowerCase()}`;
      return words.length > 0 && words.every((w) => text.includes(` ${w}`));
    };
    const staffOrAdmin = caller.roles.includes('Staff') || caller.roles.includes('SystemAdmin');

    const groups: { kind: string; items: Hit[] }[] = [
      {
        kind: 'Person',
        items: this.context
          .profiles()
          .filter((p) => matches(p.name, p.homeCity, p.bio))
          .map((p) => ({
            id: p.id,
            title: p.name,
            snippet: snippet(p.roles.join(', '), p.homeCity, p.bio),
            route: `/people/${p.id}`,
          })),
      },
      {
        kind: 'Event',
        items: this.context
          .events()
          .filter((e) => matches(e.title, e.description, e.city, e.venue))
          .map((e) => ({
            id: e.id,
            title: e.title,
            snippet: snippet(
              day(e.startsAt),
              e.format === 'Online' ? 'Online' : e.venue,
              e.city,
              e.isCancelled ? 'Cancelled' : e.visibility === 'Public' ? 'Public' : 'Members only',
            ),
            route: `/events/${e.id}`,
          })),
      },
      {
        kind: 'Partner',
        items:
          staffOrAdmin || caller.roles.some((r) => LEAD_ROLES.includes(r))
            ? this.context
                .partners()
                .filter((p) => matches(p.name, p.offering, p.contactName, p.notes))
                .map((p) => ({
                  id: p.id,
                  title: p.name,
                  snippet: snippet(
                    'Partner',
                    p.stage === 'InFunnel' ? 'In funnel' : p.stage,
                    p.offering,
                  ),
                  route: `/partners/${p.id}`,
                }))
            : [],
      },
      {
        kind: 'Contact',
        items: this.context
          .contacts()
          .filter((c) => c.ownerId === caller.profileId && !c.archivedAtUtc)
          .filter((c) => matches(c.name, c.email, c.organization, c.city))
          .map((c) => ({
            id: c.id,
            title: c.name,
            snippet: snippet(c.organization, c.city),
            route: `/contacts/${c.id}`,
          })),
      },
      {
        kind: 'WorkItem',
        items: this.workItems(caller, staffOrAdmin, matches),
      },
    ];
    return route.fulfill({
      status: 200,
      json: {
        groups: groups
          .map((g) => ({ ...g, items: g.items.slice(0, PER_GROUP) }))
          .filter((g) => g.items.length > 0),
      },
    });
  }

  private workItems(
    caller: MockCaller,
    staffOrAdmin: boolean,
    matches: (...parts: (string | null)[]) => boolean,
  ): Hit[] {
    const visible = this.context
      .workspaces()
      .filter((w) => !w.isArchived)
      .filter(
        (w) =>
          staffOrAdmin || w.ownerId === caller.profileId || w.memberIds.includes(caller.profileId),
      );
    return this.context
      .items()
      .filter((i) => !i.isArchived)
      .flatMap((i) => {
        const workspace = visible.find((w) => w.id === i.workspaceId);
        return workspace && matches(i.title, i.description)
          ? [
              {
                id: i.id,
                title: i.title,
                snippet: snippet(i.kind, workspace.name, status(i.status)),
                route: `/workspaces/${i.workspaceId}/items/${i.id}`,
              },
            ]
          : [];
      });
  }
}

function snippet(...parts: (string | null)[]): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(' · ');
}

function status(value: string): string {
  return value === 'ToDo' ? 'To Do' : value === 'InProgress' ? 'In Progress' : value;
}

/** "Sat 14 Nov 2026", in UTC like the API. */
function day(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
