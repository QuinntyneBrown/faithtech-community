import { Route } from '@playwright/test';

import type { MockHubTemplate } from './hub-templates';
import type { HubSectionKind } from './mock-event-hubs';
import type { EventsCaller } from './mock-events';
import { holds } from './role-definitions';

type Errors = Record<string, string[]>;

/** What the templates fake reads from the hubs fake, which owns the templates the hub wizard offers. */
export interface HubTemplatesHost {
  templates(): MockHubTemplate[];
  now(): Date;
  /** How many hubs were started from the template with this id. */
  hubsFrom(templateId: string): number;
  /** The kind's schema, as PUT /hub/sections/{kind} checks it. */
  validateDefault(
    kind: HubSectionKind,
    body: Record<string, unknown>,
    callerId: string | null,
  ): { content?: Record<string, unknown>; errors?: Errors };
  organisation(): {
    name: string;
    shortName: string;
    givingLink: string | null;
    givingText: string | null;
  };
  /** Consumes the failure armed by failNextTemplates(). */
  takeTemplatesFailure(): boolean;
  audit(entry: {
    action: string;
    summary: string;
    actorId?: string;
    targetType?: string;
    targetId?: string;
  }): void;
}

const NAME_MAX = 60;
const DESCRIPTION_MAX = 120;
const MAX_MINUTES = 7 * 24 * 60;

/** ManageHubTemplatesHandler.WithDefaults: the kinds a template holds text for. */
const WITH_DEFAULTS: HubSectionKind[] = [
  'Hero',
  'Agenda',
  'WhatToBring',
  'Tracks',
  'Process',
  'Rules',
  'DemoFormat',
  'Judging',
  'Worship',
  'Giving',
  'UpcomingEvents',
];

/** HubSectionKinds in catalogue order, and the core ones a new template shows. */
const ALL: HubSectionKind[] = [
  'Hero',
  'Agenda',
  'Venue',
  'Parking',
  'WhatToBring',
  'Partners',
  'Tracks',
  'Process',
  'Rules',
  'People',
  'Links',
  'DemoFormat',
  'Judging',
  'Worship',
  'Slides',
  'Giving',
  'UpcomingEvents',
];
const CORE: HubSectionKind[] = [
  'Hero',
  'Agenda',
  'Venue',
  'People',
  'Links',
  'Giving',
  'UpcomingEvents',
];

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * HubTemplatesEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/HubTemplatesEndpoints.cs,
 * docs/detailed-designs/events/edit-hub-templates): read with ManageOrganisationSettings or ManageRoles, changed with
 * ManageOrganisationSettings, each change audited as hub_template.updated. An archived template is 404 for every change
 * but Restore. It edits the same templates the hub wizard offers, so a change shows on the next hub started.
 */
export class MockHubTemplates {
  private failSave = false;

  constructor(private readonly host: HubTemplatesHost) {}

  /** Makes the next template change answer 500, to drive "Try again" (L2-185 AC7). */
  failNextSave(): void {
    this.failSave = true;
  }

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: EventsCaller | null,
  ): Promise<void> | false {
    const match =
      /^\/api\/hub-templates(?:\/([^/]+)(?:\/(archive|restore|sections)(?:\/([^/]+))?)?)?$/.exec(
        url.pathname,
      );
    if (!match) return false;
    if (!caller) return route.fulfill({ status: 401 });
    const [, id, action, kindPath] = match;
    const reads = holds(caller, 'ManageOrganisationSettings') || holds(caller, 'ManageRoles');

    if (method === 'GET') {
      if (!reads) return route.fulfill({ status: 403 });
      if (this.host.takeTemplatesFailure()) return route.fulfill({ status: 500 });
      if (!id) {
        const archived = url.searchParams.get('archived') === 'true';
        return route.fulfill({
          status: 200,
          json: this.host
            .templates()
            .filter((t) => !!t.archivedAtUtc === archived)
            .map((t, i) => this.summary(t, i)),
        });
      }
      const found = this.host.templates().find((t) => t.id === id);
      if (!found) return route.fulfill({ status: 404 });
      return route.fulfill({ status: 200, json: this.detail(found) });
    }

    if (!holds(caller, 'ManageOrganisationSettings')) return route.fulfill({ status: 403 });
    const audit = (summary: string, t: MockHubTemplate) =>
      this.host.audit({
        action: 'hub_template.updated',
        summary,
        actorId: caller.profileId,
        targetType: 'HubTemplate',
        targetId: t.id,
      });

    if (method === 'POST' && !id) {
      const errors = this.nameErrors(body, null);
      if (errors) return invalid(route, errors);
      if (this.takeFailure()) return route.fulfill({ status: 500 });
      const added: MockHubTemplate = {
        id: `template-${this.host.templates().length + 1}`,
        name: String(body['name']).trim(),
        description: text(body['description']) ?? '',
        sections: CORE.map((kind) => ({ kind, visible: true, content: null })),
        archivedAtUtc: null,
      };
      this.host.templates().push(added);
      audit(`Added the hub template ${added.name}`, added);
      return route.fulfill({ status: 201, json: this.summary(added) });
    }

    const any = id ? this.host.templates().find((t) => t.id === id) : undefined;
    if (method === 'POST' && action === 'restore') {
      if (!any || !any.archivedAtUtc) return route.fulfill({ status: 404 });
      if (this.taken(any.name, any.id))
        return route.fulfill({
          status: 409,
          json: {
            status: 409,
            detail: `There’s already a template called ${any.name}. Rename it first.`,
          },
        });
      if (this.takeFailure()) return route.fulfill({ status: 500 });
      any.archivedAtUtc = null;
      this.moveToEnd(any);
      audit(`Restored the hub template ${any.name}`, any);
      return route.fulfill({ status: 200, json: this.summary(any) });
    }

    const found = any && !any.archivedAtUtc ? any : undefined;
    if (!found) return route.fulfill({ status: 404 });

    if (method === 'PUT' && !action) {
      const errors = this.nameErrors(body, found.id);
      if (errors) return invalid(route, errors);
      if (this.takeFailure()) return route.fulfill({ status: 500 });
      found.name = String(body['name']).trim();
      found.description = text(body['description']) ?? '';
      audit(`Renamed the hub template ${found.name}`, found);
      return route.fulfill({ status: 200, json: this.summary(found) });
    }

    if (method === 'PUT' && action === 'sections' && !kindPath) {
      const shown = Array.isArray(body['shown']) ? (body['shown'] as string[]) : [];
      if (shown.some((k) => !ALL.includes(k as HubSectionKind)))
        return invalid(route, { shown: ['Choose sections from the list.'] });
      if (shown.length === 0) return invalid(route, { shown: ['Tick at least one section.'] });
      if (this.takeFailure()) return route.fulfill({ status: 500 });
      found.sections = ALL.flatMap((kind) => {
        const held = found.sections.find((s) => s.kind === kind);
        const visible = shown.includes(kind);
        if (!held && !visible) return [];
        return [{ kind, visible, content: held?.content ?? null }];
      });
      audit(`Chose the sections of the hub template ${found.name}`, found);
      return route.fulfill({ status: 200, json: this.detail(found) });
    }

    if (method === 'PUT' && action === 'sections' && kindPath) {
      const kind = ALL.find((k) => k.toLowerCase() === kindPath.toLowerCase());
      if (!kind) return route.fulfill({ status: 404 });
      if (!WITH_DEFAULTS.includes(kind))
        return invalid(route, { kind: ['This section is filled in on each hub.'] });
      const { content, errors } =
        kind === 'Agenda' ? agenda(body) : this.host.validateDefault(kind, body, caller.profileId);
      if (errors) return invalid(route, errors);
      if (this.takeFailure()) return route.fulfill({ status: 500 });
      const held = found.sections.find((s) => s.kind === kind);
      if (held) held.content = content!;
      else
        found.sections = ALL.flatMap((k) => {
          if (k === kind) return [{ kind, visible: false, content: content! }];
          const s = found.sections.find((x) => x.kind === k);
          return s ? [s] : [];
        });
      const title = kind === 'UpcomingEvents' ? 'Upcoming events' : kind;
      audit(`Edited the default ${title} of the hub template ${found.name}`, found);
      return route.fulfill({ status: 204 });
    }

    if (method === 'POST' && action === 'archive') {
      if (this.takeFailure()) return route.fulfill({ status: 500 });
      found.archivedAtUtc = this.host.now().toISOString();
      audit(`Archived the hub template ${found.name}`, found);
      return route.fulfill({ status: 200, json: this.summary(found) });
    }
    return false;
  }

  private summary(t: MockHubTemplate, index?: number) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      sortOrder: (index ?? this.host.templates().indexOf(t)) + 1,
      archived: !!t.archivedAtUtc,
      archivedAtUtc: t.archivedAtUtc ?? null,
      shown: ALL.filter((k) => t.sections.some((s) => s.kind === k && s.visible)),
      hubCount: this.host.hubsFrom(t.id),
    };
  }

  private detail(t: MockHubTemplate) {
    const { sortOrder: _sortOrder, shown: _shown, ...rest } = this.summary(t);
    return {
      ...rest,
      sections: ALL.flatMap((kind) => {
        const s = t.sections.find((x) => x.kind === kind);
        return s ? [{ kind, visible: s.visible, content: s.content }] : [];
      }),
      organisation: this.host.organisation(),
    };
  }

  private nameErrors(body: Record<string, unknown>, except: string | null): Errors | null {
    const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
    if (!name) return { name: ['Enter a name.'] };
    if (name.length > NAME_MAX) return { name: [`Use ${NAME_MAX} characters or fewer.`] };
    if ((text(body['description']) ?? '').length > DESCRIPTION_MAX)
      return { description: [`Use ${DESCRIPTION_MAX} characters or fewer.`] };
    if (this.taken(name, except)) return { name: [`There’s already a template called ${name}.`] };
    return null;
  }

  private taken(name: string, except: string | null): boolean {
    const lower = name.toLowerCase();
    return this.host
      .templates()
      .some((t) => !t.archivedAtUtc && t.id !== except && t.name.toLowerCase() === lower);
  }

  private moveToEnd(t: MockHubTemplate): void {
    const list = this.host.templates();
    list.splice(list.indexOf(t), 1);
    list.push(t);
  }

  private takeFailure(): boolean {
    const fail = this.failSave;
    this.failSave = false;
    return fail;
  }
}

/** TemplateAgendaContentValidator: rows of minutes from the start, up to a week. */
function agenda(body: Record<string, unknown>): {
  content?: Record<string, unknown>;
  errors?: Errors;
} {
  const items = Array.isArray(body['items']) ? (body['items'] as Record<string, unknown>[]) : [];
  const errors: Errors = {};
  const add = (field: string, message: string) => (errors[field] ??= [message]);
  if (items.length > 40) add('items', 'You can add up to 40 rows.');
  else
    items.forEach((item, i) => {
      const minutes = item['minutes'];
      if (typeof minutes !== 'number') add(`items[${i}].minutes`, 'Enter a time.');
      else if (minutes < 0 || minutes > MAX_MINUTES)
        add(`items[${i}].minutes`, 'Use a time within a week of the start.');
      const title = text(item['title']);
      if (!title) add(`items[${i}].title`, 'Say what’s happening.');
      else if (title.length > 100) add(`items[${i}].title`, 'Use 100 characters or fewer.');
      if ((text(item['detail']) ?? '').length > 200)
        add(`items[${i}].detail`, 'Use 200 characters or fewer.');
    });
  if (Object.keys(errors).length) return { errors };
  return {
    content: {
      items: items.map((item) => ({
        minutes: item['minutes'],
        title: text(item['title']),
        detail: text(item['detail']),
      })),
    },
  };
}

function invalid(route: Route, errors: Errors) {
  return route.fulfill({ status: 400, json: { status: 400, errors } });
}
