import { Route } from '@playwright/test';

import { MockCaller } from './mock-contacts';
import { match as duplicateMatch, normaliseHost } from './partner-duplicates';

/** What MockApi shares with the partners fake: "now" and the profiles that can own or move partners. */
export interface PartnersContext {
  now: Date;
  profiles: Map<string, { id: string; name: string; roles: string[] }>;
  addAuditEntry(entry: {
    action: string;
    summary: string;
    actorId?: string;
    actorName?: string;
    targetType?: string;
    targetId?: string;
    after?: string | null;
  }): void;
}

/** One row of PartnerDuplicateDismissals: the pair, lower id first (L2-113 AC6). */
export interface MockDismissal {
  lower: string;
  higher: string;
  byId: string;
  atUtc: string;
}

export type MockStage = 'Lead' | 'InFunnel' | 'Confirmed';

export type MockActivityKind =
  'Call' | 'Email' | 'Meeting' | 'Note' | 'Added' | 'StageMoved' | 'Merged' | 'Restored';

/** One row of PartnerActivities. */
export interface MockActivity {
  id: string;
  kind: MockActivityKind;
  summary: string | null;
  /** yyyy-MM-dd. */
  occurredOn: string;
  /** HH:mm:ss or null. */
  occurredAt: string | null;
  nextStep: string | null;
  nextStepDue: string | null;
  loggedById: string;
  loggedAtUtc: string;
  fromStage: MockStage | null;
  toStage: MockStage | null;
  /** The other partner of a Merged or Restored entry. */
  relatedPartnerId: string | null;
  /** The partner the entry was first written on, when a merge moved it. */
  mergedFromPartnerId: string | null;
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
  activities: MockActivity[];
  /** Every edit, move, merge and restore moves it on (ADR 0028). */
  version: number;
  archivedAtUtc: string | null;
  mergedIntoId: string | null;
  mergedById: string | null;
  mergedAtUtc: string | null;
}

const STAGES: MockStage[] = ['Lead', 'InFunnel', 'Confirmed'];
const LEAD_ROLES = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGGED: MockActivityKind[] = ['Call', 'Email', 'Meeting', 'Note'];
const DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;
const STAGE_LABELS: Record<MockStage, string> = {
  Lead: 'Lead',
  InFunnel: 'In funnel',
  Confirmed: 'Confirmed',
};
const FILTERS: Record<string, MockActivityKind[]> = {
  Call: ['Call'],
  Email: ['Email'],
  Meeting: ['Meeting'],
  Note: ['Note'],
  Stage: ['Added', 'StageMoved', 'Merged', 'Restored'],
};

/** PartnerTimelineOrder: date, time (none as 00:00), log time, id; all newest first. */
function newest(activities: MockActivity[]): MockActivity[] {
  const key = (a: MockActivity) =>
    `${a.occurredOn}|${a.occurredAt ?? '00:00:00'}|${a.loggedAtUtc}|${a.id.padStart(16, '0')}`;
  return [...activities].sort((a, b) => key(b).localeCompare(key(a)));
}

/** PartnerTimelineViews.Text: {name} is the record the entry was first written on, {other} the related one. */
function text(name: string, other: string, activity: MockActivity): string {
  switch (activity.kind) {
    case 'Added':
      return !activity.toStage || activity.toStage === 'Lead'
        ? `Added ${name} as a lead`
        : `Added ${name} at ${STAGE_LABELS[activity.toStage]}`;
    case 'StageMoved': {
      const note = activity.summary ? `: “${activity.summary}”` : '';
      return `Moved ${name} from ${STAGE_LABELS[activity.fromStage!]} to ${STAGE_LABELS[activity.toStage!]}${note}`;
    }
    case 'Merged':
      return `Merged ${other} into ${name}`;
    case 'Restored':
      return activity.toStage
        ? `Restored ${name} from ${other}`
        : `Restored ${other} as its own partner`;
    default:
      return activity.summary ?? '';
  }
}

/**
 * PartnersEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/PartnersEndpoints.cs):
 * lead roles, Staff and System Admin read; Staff never write; everyone else gets 403 (ADR 0014).
 */
export class MockPartners {
  readonly partners: MockPartner[] = [];
  /** "Not the same" pairs; seed one with `dismiss`. */
  readonly dismissals: MockDismissal[] = [];

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
      activities: [],
      version: 1,
      archivedAtUtc: null,
      mergedIntoId: null,
      mergedById: null,
      mergedAtUtc: null,
      ...partner,
    };
    this.partners.push(full);
    // ManagePartnersHandler.CreateAsync writes the Added entry in the same save.
    if (!partner.activities) {
      this.addActivity(full, {
        kind: 'Added',
        summary: null,
        occurredAt: this.context.now.toISOString().slice(11, 19),
        loggedById: full.ownerId ?? '',
        toStage: full.stage,
      });
    }
    return full;
  }

  /** Seeds a timeline entry for a test; the defaults are a Note logged at the fake's "now". */
  addActivity(partner: MockPartner, activity: Partial<MockActivity> = {}): MockActivity {
    const full: MockActivity = {
      id: `activity-${this.activityCount++}`,
      kind: 'Note',
      summary: 'Checked in.',
      occurredOn: this.context.now.toISOString().slice(0, 10),
      occurredAt: null,
      nextStep: null,
      nextStepDue: null,
      loggedById: '',
      loggedAtUtc: this.context.now.toISOString(),
      fromStage: null,
      toStage: null,
      relatedPartnerId: null,
      mergedFromPartnerId: null,
      ...activity,
    };
    partner.activities.push(full);
    return full;
  }

  private activityCount = 1;

  /** Someone else changed the partner: its version moves on, as an edit or a move would. */
  bumpVersion(partnerId: string): void {
    this.partners.find((p) => p.id === partnerId)!.version++;
  }

  /** Stores "Not the same" for the pair, as PartnerDuplicateDismissal.For does. */
  dismiss(a: string, b: string, byId = ''): void {
    const [lower, higher] = a < b ? [a, b] : [b, a];
    if (this.dismissals.some((d) => d.lower === lower && d.higher === higher)) return;
    this.dismissals.push({ lower, higher, byId, atUtc: this.context.now.toISOString() });
  }

  /** Answers a /api/partners request, or returns false when the path is not a partners route. */
  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockCaller | null,
  ): Promise<void> | false {
    const match = /^\/api\/partners(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+)\/(dismissal))?$/.exec(
      url.pathname,
    );
    if (!match) return false;
    if (!caller) return route.fulfill({ status: 401 });
    const [, id, action, otherId, dismissal] = match;
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
      partner.activities[0].loggedById = caller.profileId;
      return route.fulfill({ status: 201, json: this.dto(partner, canWrite, caller) });
    }

    const partner = this.partners.find((p) => p.id === id);
    if (!partner) return route.fulfill({ status: 404 });
    if (method === 'GET' && action === 'duplicates' && !otherId)
      return route.fulfill({ status: 200, json: { matches: this.duplicates(partner) } });
    if (method === 'POST' && action === 'duplicates' && dismissal) {
      if (otherId === partner.id) return route.fulfill({ status: 400, json: { status: 400 } });
      const other = this.partners.find((p) => p.id === otherId);
      if (!other) return route.fulfill({ status: 404 });
      const merged = [partner, other].find((p) => p.archivedAtUtc);
      if (merged) {
        return route.fulfill({
          status: 409,
          json: { status: 409, detail: `${merged.name} has already been merged.` },
        });
      }
      this.dismiss(partner.id, other.id, caller.profileId);
      // PartnerAccess.AuditAdminWrite: a System Admin without a lead role is audited.
      if (!caller.roles.some((r) => LEAD_ROLES.includes(r))) {
        this.context.addAuditEntry({
          action: 'partner.duplicate.dismissed',
          summary: `Marked ${partner.name} and ${other.name} as different partners`,
          actorId: caller.profileId,
          actorName: this.context.profiles.get(caller.profileId)?.name ?? 'A former member',
          targetType: 'Partner',
          targetId: partner.id,
          after: JSON.stringify({ OtherId: other.id }),
        });
      }
      return route.fulfill({ status: 204 });
    }
    if (method === 'GET' && !action)
      return route.fulfill({ status: 200, json: this.dto(partner, canWrite, caller) });
    // An archived partner refuses edits, moves and logged activities (ADR 0028, L2-112 AC6).
    const write =
      method === 'PUT' || (method === 'POST' && ['stage', 'activities'].includes(action));
    if (partner.archivedAtUtc && write) {
      const kept = this.partners.find((p) => p.id === partner.mergedIntoId)?.name;
      const instruction =
        action === 'activities' ? 'Log it there.' : action === 'stage' ? 'Move it there.' : '';
      return route.fulfill({
        status: 409,
        json: {
          status: 409,
          detail: `${partner.name} was merged into ${kept}. ${instruction || 'Change it there.'}`,
        },
      });
    }
    if (method === 'PUT' && !action) {
      const errors = this.validate(body);
      if (errors) return route.fulfill({ status: 400, json: { status: 400, errors } });
      Object.assign(partner, this.details(body));
      partner.version++;
      return route.fulfill({ status: 200, json: this.dto(partner, canWrite, caller) });
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
      this.addActivity(partner, {
        kind: 'StageMoved',
        summary: String(body['note'] ?? '').trim() || null,
        occurredAt: this.context.now.toISOString().slice(11, 19),
        loggedById: caller.profileId,
        fromStage: partner.stage,
        toStage: to,
      });
      partner.stage = to;
      partner.version++;
      return route.fulfill({ status: 200, json: this.dto(partner, canWrite, caller) });
    }
    if (method === 'POST' && action === 'merge') return this.merge(route, partner, body, caller);
    if (method === 'POST' && action === 'restore')
      return this.restore(route, partner, body, caller);
    if (method === 'GET' && action === 'activities') {
      const kind = url.searchParams.get('kind');
      if (kind && !FILTERS[kind]) return route.fulfill({ status: 400, json: { status: 400 } });
      const page = this.timeline(partner, kind, url.searchParams.get('before'));
      if (!page) return route.fulfill({ status: 400, json: { status: 400 } });
      return route.fulfill({ status: 200, json: page });
    }
    if (method === 'POST' && action === 'activities') {
      const errors = this.validateActivity(body);
      if (errors) return route.fulfill({ status: 400, json: { status: 400, errors } });
      const nextStep = String(body['nextStep'] ?? '').trim() || null;
      const time = (body['occurredAt'] as string | null) || null;
      const activity = this.addActivity(partner, {
        kind: body['kind'] as MockActivityKind,
        summary: String(body['summary']).trim(),
        occurredOn: String(body['occurredOn']),
        occurredAt: time ? `${time.slice(0, 5)}:00` : null,
        nextStep,
        nextStepDue: nextStep ? (body['nextStepDue'] as string | null) || null : null,
        loggedById: caller.profileId,
      });
      return route.fulfill({
        status: 201,
        headers: { location: `/api/partners/${partner.id}/activities/${activity.id}` },
        json: this.activityDto(partner, activity),
      });
    }
    return route.fulfill({ status: 405 });
  }

  /** MergePartnersHandler.MergeAsync: the same checks, order, messages and status codes. */
  private merge(
    route: Route,
    kept: MockPartner,
    body: Record<string, unknown>,
    caller: MockCaller,
  ): Promise<void> {
    const choices = (body['choices'] ?? {}) as Record<string, string | undefined>;
    if (Object.values(choices).some((c) => c !== undefined && c !== 'keep' && c !== 'other')) {
      return route.fulfill({
        status: 400,
        json: { status: 400, errors: { Choices: ['Choose which value to keep.'] } },
      });
    }
    if (body['otherId'] === kept.id) {
      return route.fulfill({
        status: 400,
        json: { status: 400, errors: { OtherId: ['Choose two different partners.'] } },
      });
    }
    const other = this.partners.find((p) => p.id === body['otherId']);
    if (!other) return route.fulfill({ status: 404 });
    const archived = [kept, other].find((p) => p.archivedAtUtc);
    if (archived) {
      return route.fulfill({
        status: 409,
        json: { status: 409, detail: `${archived.name} has already been merged.` },
      });
    }
    for (const [partner, seen] of [
      [kept, body['keepVersion']],
      [other, body['otherVersion']],
    ] as const) {
      if (partner.version !== seen) {
        return route.fulfill({
          status: 409,
          json: {
            status: 409,
            detail: `Someone changed ${partner.name} while you were comparing. Nothing was changed; reload and try again.`,
            partnerId: partner.id,
          },
        });
      }
    }
    const notes = [kept.notes, other.notes].filter(Boolean).join('\n\n') || null;
    if (notes && notes.length > 2000) {
      return route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: {
            Notes: [
              'The joined notes are longer than 2,000 characters. Shorten the notes on one partner, then merge.',
            ],
          },
        },
      });
    }
    this.mergeInto(kept, other, caller.profileId, choices, notes);
    return route.fulfill({ status: 200, json: this.dto(kept, true, caller) });
  }

  /**
   * Merges `other` into `kept` as MergePartnersHandler does; a spec may call it to seed an archived
   * partner. Missing choices keep the kept record's values.
   */
  mergeInto(
    kept: MockPartner,
    other: MockPartner,
    byId: string,
    choices: Record<string, string | undefined> = {},
    notes = [kept.notes, other.notes].filter(Boolean).join('\n\n') || null,
  ): void {
    const pick = <K extends keyof MockPartner>(choice: string, field: K) =>
      choices[choice] === 'other' ? other[field] : kept[field];
    const fromStage = kept.stage;
    Object.assign(kept, {
      name: pick('name', 'name'),
      stage: pick('stage', 'stage'),
      contactName: pick('contactName', 'contactName'),
      email: pick('email', 'email'),
      phone: pick('phone', 'phone'),
      website: pick('website', 'website'),
      offering: pick('offering', 'offering'),
      ownerId: pick('owner', 'ownerId'),
      notes,
    });
    kept.version++;
    for (const activity of other.activities) {
      activity.mergedFromPartnerId ??= other.id;
      kept.activities.push(activity);
    }
    other.activities = [];
    const now = this.context.now.toISOString();
    const changed = fromStage !== kept.stage;
    this.addActivity(kept, {
      kind: 'Merged',
      summary: null,
      occurredAt: now.slice(11, 19),
      loggedById: byId,
      relatedPartnerId: other.id,
      fromStage: changed ? fromStage : null,
      toStage: changed ? kept.stage : null,
    });
    Object.assign(other, {
      archivedAtUtc: now,
      mergedIntoId: kept.id,
      mergedById: byId,
      mergedAtUtc: now,
    });
    other.version++;
    this.context.addAuditEntry({
      action: 'partners.merged',
      summary: `Merged ${other.name} into ${kept.name}`,
      actorId: byId,
      actorName: this.context.profiles.get(byId)?.name ?? 'A former member',
      targetType: 'Partner',
      targetId: kept.id,
      after: JSON.stringify({ OtherId: other.id, Choices: choices }),
    });
  }

  /** RestorePartnerHandler.RestoreAsync: rows first written on the partner move back from wherever they are. */
  private restore(
    route: Route,
    partner: MockPartner,
    body: Record<string, unknown>,
    caller: MockCaller,
  ): Promise<void> {
    if (!caller.roles.includes('SystemAdmin')) return route.fulfill({ status: 403 });
    if (!partner.archivedAtUtc) {
      return route.fulfill({
        status: 409,
        json: { status: 409, detail: `${partner.name} is not archived.` },
      });
    }
    const kept = this.partners.find((p) => p.id === partner.mergedIntoId)!;
    if (kept.archivedAtUtc) {
      return route.fulfill({
        status: 409,
        json: { status: 409, detail: `Restore ${kept.name} first.` },
      });
    }
    if (partner.version !== body['version'] || kept.version !== body['mergedIntoVersion']) {
      return route.fulfill({
        status: 409,
        json: {
          status: 409,
          detail:
            'Someone changed these partners since the page loaded. Nothing was changed; reload and try again.',
        },
      });
    }
    let moved = 0;
    for (const holder of this.partners) {
      const back = holder.activities.filter((a) => a.mergedFromPartnerId === partner.id);
      holder.activities = holder.activities.filter((a) => a.mergedFromPartnerId !== partner.id);
      for (const activity of back) {
        activity.mergedFromPartnerId = null;
        partner.activities.push(activity);
        moved++;
      }
    }
    Object.assign(partner, {
      archivedAtUtc: null,
      mergedIntoId: null,
      mergedById: null,
      mergedAtUtc: null,
    });
    partner.version++;
    kept.version++;
    const at = this.context.now.toISOString().slice(11, 19);
    this.addActivity(partner, {
      kind: 'Restored',
      summary: null,
      occurredAt: at,
      loggedById: caller.profileId,
      relatedPartnerId: kept.id,
      toStage: partner.stage,
    });
    this.addActivity(kept, {
      kind: 'Restored',
      summary: null,
      occurredAt: at,
      loggedById: caller.profileId,
      relatedPartnerId: partner.id,
    });
    this.context.addAuditEntry({
      action: 'partner.restored',
      summary: `Restored ${partner.name} from ${kept.name}`,
      actorId: caller.profileId,
      actorName: this.context.profiles.get(caller.profileId)?.name ?? 'A former member',
      targetType: 'Partner',
      targetId: partner.id,
      after: JSON.stringify({ MovedActivities: moved }),
    });
    return route.fulfill({ status: 200, json: this.dto(partner, true, caller) });
  }

  /** PartnerDuplicatesHandler.ListAsync: undismissed matches by name, with each one's Added entry. */
  private duplicates(partner: MockPartner) {
    if (partner.archivedAtUtc) return [];
    const dismissed = (other: MockPartner) =>
      this.dismissals.some(
        (d) =>
          (d.lower === partner.id && d.higher === other.id) ||
          (d.lower === other.id && d.higher === partner.id),
      );
    return this.partners
      .filter((p) => p.id !== partner.id && !p.archivedAtUtc && !dismissed(p))
      .map((p) => ({ other: p, reason: duplicateMatch(partner, p) }))
      .filter((m) => m.reason !== null)
      .sort((a, b) => a.other.name.localeCompare(b.other.name))
      .map(({ other, reason }) => {
        const added = other.activities.find((a) => a.kind === 'Added');
        return {
          id: other.id,
          name: other.name,
          reason,
          matchedOn: reason === 'Website' ? normaliseHost(other.website) : other.name,
          addedByName: added ? (this.context.profiles.get(added.loggedById)?.name ?? null) : null,
          addedOn: added?.occurredOn ?? null,
        };
      });
  }

  /** PartnerTimelineOrder and PartnerTimelineFilter, 50 a page; `before` is the last entry's id here. */
  private timeline(partner: MockPartner, kind: string | null, before: string | null) {
    const kinds = kind ? FILTERS[kind] : null;
    const sorted = newest(partner.activities).filter((a) => !kinds || kinds.includes(a.kind));
    const start = before ? sorted.findIndex((a) => a.id === before) + 1 : 0;
    if (before && start === 0) return null;
    const items = sorted.slice(start, start + PAGE_SIZE);
    const more = sorted.length > start + PAGE_SIZE;
    return {
      items: items.map((a) => this.activityDto(partner, a)),
      before: more ? items[items.length - 1].id : null,
    };
  }

  /** PartnerTimelineViews: the logger's name and the sentence the timeline shows. */
  private activityDto(partner: MockPartner, activity: MockActivity) {
    const name = this.context.profiles.get(activity.loggedById)?.name ?? 'A former member';
    const partnerName = (id: string | null) =>
      id ? (this.partners.find((p) => p.id === id)?.name ?? null) : null;
    const from = partnerName(activity.mergedFromPartnerId);
    const related = partnerName(activity.relatedPartnerId);
    return {
      ...activity,
      text: text(from ?? partner.name, related ?? 'another partner', activity),
      loggedByName: name,
      relatedPartnerName: related,
      mergedFromPartnerName: from,
    };
  }

  /** LogPartnerActivityValidator; "today" is the UTC date plus one day. */
  private validateActivity(body: Record<string, unknown>): Record<string, string[]> | null {
    const errors: Record<string, string[]> = {};
    if (!LOGGED.includes(body['kind'] as MockActivityKind))
      errors['Kind'] = ['Choose call, email, meeting or note.'];
    const summary = String(body['summary'] ?? '').trim();
    if (!summary) errors['Summary'] = ['Say what happened.'];
    else if (summary.length > 2000)
      errors['Summary'] = ['Use 2,000 characters or fewer for what happened.'];
    const occurredOn = (body['occurredOn'] as string | null) ?? '';
    const latest = new Date(this.context.now.getTime() + DAY).toISOString().slice(0, 10);
    if (!occurredOn) errors['OccurredOn'] = ['Enter the date it happened.'];
    else if (occurredOn > latest) errors['OccurredOn'] = ['Choose today or an earlier date.'];
    const nextStep = String(body['nextStep'] ?? '').trim();
    if (nextStep.length > 200)
      errors['NextStep'] = ['Use 200 characters or fewer for the next step.'];
    if (body['nextStepDue'] && !nextStep)
      errors['NextStepDue'] = ['Add the next step, or clear its due date.'];
    return Object.keys(errors).length ? errors : null;
  }

  private board(canEdit: boolean) {
    return {
      canEdit,
      columns: STAGES.map((stage) => {
        const cards = this.partners
          .filter((p) => p.stage === stage && !p.archivedAtUtc)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({
            id: p.id,
            name: p.name,
            contactName: p.contactName,
            offering: p.offering,
            nextStep: this.nextStep(p)?.nextStep ?? null,
            nextStepDue: this.nextStep(p)?.nextStepDue ?? null,
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

  /** PartnerViews.ToDtoAsync: an archived partner says who merged it and is read-only. */
  private dto(partner: MockPartner, canWrite: boolean, caller?: MockCaller) {
    const name = (id: string | null) => (id ? (this.context.profiles.get(id)?.name ?? null) : null);
    const { activities, archivedAtUtc, mergedIntoId, mergedById, mergedAtUtc, ...record } = partner;
    const next = this.nextStep(partner);
    const kept = this.partners.find((p) => p.id === mergedIntoId);
    const canEdit = canWrite && !archivedAtUtc;
    return {
      ...record,
      ownerName: name(partner.ownerId),
      canEdit,
      lastActivityOn: newest(activities)[0]?.occurredOn ?? null,
      nextStep: next?.nextStep ?? null,
      nextStepDue: next?.nextStepDue ?? null,
      canLogActivity: canEdit,
      archived:
        archivedAtUtc && kept
          ? {
              mergedIntoId: kept.id,
              mergedIntoName: kept.name,
              mergedIntoVersion: kept.version,
              mergedById: mergedById ?? '',
              mergedByName: name(mergedById) ?? 'A former member',
              mergedAtUtc: mergedAtUtc ?? archivedAtUtc,
            }
          : null,
      canRestore: !!archivedAtUtc && !!caller?.roles.includes('SystemAdmin'),
    };
  }

  /** The latest logged activity with a next step, in timeline order. */
  private nextStep(partner: MockPartner): MockActivity | undefined {
    return newest(partner.activities).find((a) => LOGGED.includes(a.kind) && a.nextStep);
  }
}
