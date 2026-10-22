import { Route } from '@playwright/test';

import { MockCaller } from './mock-contacts';

/** What MockApi shares with the partners fake: "now" and the profiles that can own or move partners. */
export interface PartnersContext {
  now: Date;
  profiles: Map<string, { id: string; name: string; roles: string[] }>;
}

export type MockStage = 'Lead' | 'InFunnel' | 'Confirmed';

export interface MockStageChange {
  from: MockStage;
  to: MockStage;
  movedById: string;
  movedAtUtc: string;
  note: string | null;
}

/** A partner as the Partners table holds it. */
export interface MockPartner {
  id: string;
  name: string;
  website: string | null;
  offering: string | null;
  ownerId: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  stage: MockStage;
  history: MockStageChange[];
}

const STAGES: MockStage[] = ['Lead', 'InFunnel', 'Confirmed'];
const LEAD_ROLES = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PartnersEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/PartnersEndpoints.cs):
 * lead roles, Staff and System Admin read; Staff never write; everyone else gets 403 (ADR 0014).
 */
export class MockPartners {
  readonly partners: MockPartner[] = [];

  constructor(private readonly context: PartnersContext) {}

  add(partner: Partial<MockPartner> & { name: string }): MockPartner {
    const full: MockPartner = {
      id: `partner-${this.partners.length + 1}`,
      website: null,
      offering: null,
      ownerId: null,
      contactName: null,
      email: null,
      phone: null,
      notes: null,
      stage: 'Lead',
      history: [],
      ...partner,
    };
    this.partners.push(full);
    return full;
  }

  /** Answers a /api/partners request, or returns false when the path is not a partners route. */
  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockCaller | null,
  ): Promise<void> | false {
    const match = /^\/api\/partners(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(url.pathname);
    if (!match) return false;
    if (!caller) return route.fulfill({ status: 401 });
    const [, id, action] = match;
    const canWrite = caller.roles.some((r) => LEAD_ROLES.includes(r) || r === 'SystemAdmin');
    const canRead = canWrite || caller.roles.includes('Staff');
    if (!canRead) return route.fulfill({ status: 403 });
    const writing = method !== 'GET';
    if (writing && !canWrite) return route.fulfill({ status: 403 });

    if (!id && method === 'GET') return route.fulfill({ status: 200, json: this.board(canWrite) });
    if (id === 'owners' && method === 'GET')
      return route.fulfill({ status: 200, json: this.owners() });
    if (!id && method === 'POST') {
      const errors = this.validate(body);
      if (errors) return route.fulfill({ status: 400, json: { status: 400, errors } });
      const stage = (body['stage'] as MockStage | undefined) ?? 'Lead';
      const partner = this.add({ ...this.details(body), stage });
      return route.fulfill({ status: 201, json: this.dto(partner, canWrite) });
    }

    const partner = this.partners.find((p) => p.id === id);
    if (!partner) return route.fulfill({ status: 404 });
    if (method === 'GET' && !action)
      return route.fulfill({ status: 200, json: this.dto(partner, canWrite) });
    if (method === 'PUT' && !action) {
      const errors = this.validate(body);
      if (errors) return route.fulfill({ status: 400, json: { status: 400, errors } });
      Object.assign(partner, this.details(body));
      return route.fulfill({ status: 200, json: this.dto(partner, canWrite) });
    }
    if (method === 'POST' && action === 'stage') {
      const to = body['to'] as MockStage;
      if (!STAGES.includes(to)) {
        return route.fulfill({
          status: 400,
          json: { status: 400, errors: { To: ['Choose a stage.'] } },
        });
      }
      if (to === partner.stage) {
        return route.fulfill({
          status: 409,
          json: { status: 409, detail: `The partner is already at the ${to} stage.` },
        });
      }
      partner.history.push({
        from: partner.stage,
        to,
        movedById: caller.profileId,
        movedAtUtc: this.context.now.toISOString(),
        note: String(body['note'] ?? '').trim() || null,
      });
      partner.stage = to;
      return route.fulfill({ status: 200, json: this.dto(partner, canWrite) });
    }
    return route.fulfill({ status: 405 });
  }

  private board(canEdit: boolean) {
    return {
      canEdit,
      columns: STAGES.map((stage) => {
        const cards = this.partners
          .filter((p) => p.stage === stage)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({
            id: p.id,
            name: p.name,
            contactName: p.contactName,
            offering: p.offering,
          }));
        return { stage, count: cards.length, cards };
      }),
    };
  }

  private owners() {
    return [...this.context.profiles.values()]
      .filter((p) => p.roles.some((r) => LEAD_ROLES.includes(r)))
      .map((p) => ({ profileId: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private validate(body: Record<string, unknown>): Record<string, string[]> | null {
    const errors: Record<string, string[]> = {};
    if (!String(body['name'] ?? '').trim()) errors['Name'] = ['Enter the organisation’s name.'];
    const email = String(body['email'] ?? '').trim();
    if (email && !EMAIL.test(email)) {
      errors['Email'] = ['Enter an email like name@example.org, or leave it empty.'];
    }
    return Object.keys(errors).length ? errors : null;
  }

  private details(body: Record<string, unknown>) {
    const blank = (key: string) => String(body[key] ?? '').trim() || null;
    return {
      name: String(body['name'] ?? '').trim(),
      website: blank('website'),
      offering: blank('offering'),
      ownerId: (body['ownerId'] as string | null) || null,
      contactName: blank('contactName'),
      email: blank('email'),
      phone: blank('phone'),
      notes: blank('notes'),
    };
  }

  private dto(partner: MockPartner, canEdit: boolean) {
    const name = (id: string | null) => (id ? (this.context.profiles.get(id)?.name ?? null) : null);
    return {
      ...partner,
      ownerName: name(partner.ownerId),
      history: [...partner.history]
        .sort((a, b) => b.movedAtUtc.localeCompare(a.movedAtUtc))
        .map((c) => ({ ...c, movedByName: name(c.movedById) ?? 'A former member' })),
      canEdit,
    };
  }
}
