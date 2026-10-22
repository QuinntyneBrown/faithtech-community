import { Route } from '@playwright/test';

/** What MockApi shares with the contacts fake: the signed-in caller and the accounts and profiles. */
export interface ContactsContext {
  now: Date;
  accounts: Map<string, { email: string; verified: boolean; profileId: string }>;
  profiles: Map<
    string,
    { id: string; name: string; photos: { url: string; altText: string; isFeatured: boolean }[] }
  >;
}

export interface MockCaller {
  profileId: string;
  roles: string[];
}

export interface MockNote {
  id: string;
  body: string;
  createdAtUtc: string;
}

/** A private contact as the Contacts table holds it. */
export interface MockContact {
  id: string;
  ownerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  city: string | null;
  linkedProfileId: string | null;
  archivedAtUtc: string | null;
  createdAtUtc: string;
  notes: MockNote[];
}

const LEAD_ROLES = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ContactsEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/ContactsEndpoints.cs):
 * lead roles and System Admin only, another lead's contact is 404 (ADR 0014).
 */
export class MockContacts {
  readonly contacts: MockContact[] = [];
  private notes = 0;

  constructor(private readonly context: ContactsContext) {}

  add(contact: Partial<MockContact> & { ownerId: string; name: string }): MockContact {
    const full: MockContact = {
      id: `contact-${this.contacts.length + 1}`,
      email: null,
      phone: null,
      organization: null,
      city: null,
      linkedProfileId: null,
      archivedAtUtc: null,
      createdAtUtc: this.context.now.toISOString(),
      notes: [],
      ...contact,
    };
    this.contacts.push(full);
    return full;
  }

  /** A note dated `daysAgo` before "now". */
  note(body: string, daysAgo = 0): MockNote {
    const at = new Date(this.context.now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return { id: `note-${++this.notes}`, body, createdAtUtc: at.toISOString() };
  }

  /** Answers a /api/contacts request, or returns false when the path is not a contacts route. */
  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockCaller | null,
  ): Promise<void> | false {
    const match = /^\/api\/contacts(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(url.pathname);
    if (!match) return false;
    if (!caller) return route.fulfill({ status: 401 });
    const [, id, action] = match;
    const keeps = caller.roles.some((r) => LEAD_ROLES.includes(r) || r === 'SystemAdmin');

    if (!id) {
      if (!keeps) return route.fulfill({ status: 403 });
      if (method === 'GET') return this.list(route, caller, url.searchParams.get('q'));
      if (method === 'POST') return this.create(route, caller, body);
    }
    if (id === 'archived' && method === 'GET') {
      if (!keeps) return route.fulfill({ status: 403 });
      return this.archived(route, caller);
    }

    const contact = this.contacts.find((c) => c.id === id);
    const visible =
      contact && (contact.ownerId === caller.profileId || caller.roles.includes('SystemAdmin'));
    if (!contact || !visible) return route.fulfill({ status: 404 });

    switch (`${method} ${action ?? ''}`) {
      case 'GET ':
        return this.json(route, 200, this.dto(contact, caller));
      case 'PUT ': {
        const errors = this.validate(body);
        if (errors) return this.json(route, 400, { status: 400, errors });
        Object.assign(contact, this.details(body));
        return this.json(route, 200, this.dto(contact, caller));
      }
      case 'GET notes':
        return this.json(route, 200, this.sortedNotes(contact));
      case 'POST notes': {
        const text = String(body['body'] ?? '').trim();
        if (!text)
          return this.json(route, 400, {
            status: 400,
            errors: { Body: ['Write a note to save.'] },
          });
        const note = this.note(text);
        contact.notes.push(note);
        return this.json(route, 201, note);
      }
      case 'POST archive':
        if (contact.archivedAtUtc) return this.conflict(route, 'The contact is already archived.');
        contact.archivedAtUtc = this.context.now.toISOString();
        return route.fulfill({ status: 204 });
      case 'POST restore':
        if (!contact.archivedAtUtc) return this.conflict(route, 'The contact is not archived.');
        contact.archivedAtUtc = null;
        return route.fulfill({ status: 204 });
      case 'DELETE ':
        if (!contact.archivedAtUtc)
          return this.conflict(route, 'Archive the contact before deleting it.');
        this.contacts.splice(this.contacts.indexOf(contact), 1);
        return route.fulfill({ status: 204 });
      case 'POST link': {
        const profileId = String(body['profileId'] ?? '');
        if (!this.context.profiles.has(profileId)) return route.fulfill({ status: 404 });
        if (contact.linkedProfileId)
          return this.conflict(route, 'The contact is already linked to a profile.');
        contact.linkedProfileId = profileId;
        if (body['discardNotes']) contact.notes = [];
        return this.json(route, 200, this.dto(contact, caller));
      }
      default:
        return route.fulfill({ status: 405 });
    }
  }

  private list(route: Route, caller: MockCaller, q: string | null) {
    const term = (q ?? '').trim().toLowerCase();
    const has = (v: string | null) => !!v && v.toLowerCase().includes(term);
    const rows = this.contacts
      .filter((c) => c.ownerId === caller.profileId && !c.archivedAtUtc)
      .filter(
        (c) =>
          !term ||
          has(c.name) ||
          has(c.email) ||
          has(c.organization) ||
          c.notes.some((n) => has(n.body)),
      )
      .map((c) => this.summary(c))
      .sort((a, b) => a.name.localeCompare(b.name));
    return this.json(route, 200, rows);
  }

  private archived(route: Route, caller: MockCaller) {
    const rows = this.contacts
      .filter((c) => c.ownerId === caller.profileId && c.archivedAtUtc)
      .map((c) => this.summary(c))
      .sort((a, b) => b.archivedAtUtc!.localeCompare(a.archivedAtUtc!));
    return this.json(route, 200, rows);
  }

  private create(route: Route, caller: MockCaller, body: Record<string, unknown>) {
    const errors = this.validate(body);
    if (errors) return this.json(route, 400, { status: 400, errors });
    const details = this.details(body);
    const member = this.member(details.email);
    if (member && !body['linkToMember']) {
      return this.json(route, 409, {
        status: 409,
        detail: `${member.name} is already a member.`,
        memberName: member.name,
      });
    }
    const notes = String(body['notes'] ?? '').trim();
    const contact = this.add({
      ownerId: caller.profileId,
      ...details,
      linkedProfileId: member?.id ?? null,
      notes: notes ? [this.note(notes)] : [],
    });
    return this.json(route, 201, this.dto(contact, caller));
  }

  private validate(body: Record<string, unknown>): Record<string, string[]> | null {
    const errors: Record<string, string[]> = {};
    if (!String(body['name'] ?? '').trim()) errors['Name'] = ['Enter at least a first name.'];
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
      email: blank('email'),
      phone: blank('phone'),
      organization: blank('organization'),
      city: blank('city'),
    };
  }

  /** The verified member who uses this email (ADR 0014). */
  private member(email: string | null) {
    if (!email) return null;
    const account = this.context.accounts.get(email.toLowerCase());
    return account?.verified ? (this.context.profiles.get(account.profileId) ?? null) : null;
  }

  private sortedNotes(contact: MockContact): MockNote[] {
    return [...contact.notes].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  }

  private summary(contact: MockContact) {
    const linked = contact.linkedProfileId
      ? this.context.profiles.get(contact.linkedProfileId)
      : null;
    return {
      id: contact.id,
      name: linked?.name ?? contact.name,
      email: contact.email,
      organization: contact.organization,
      city: contact.city,
      status: linked ? 'Member' : this.member(contact.email) ? 'SignedUp' : 'Private',
      archivedAtUtc: contact.archivedAtUtc,
    };
  }

  private dto(contact: MockContact, caller: MockCaller) {
    const linked = contact.linkedProfileId
      ? this.context.profiles.get(contact.linkedProfileId)
      : null;
    const photo = linked?.photos.find((p) => p.isFeatured) ?? null;
    const member = linked ? null : this.member(contact.email);
    return {
      id: contact.id,
      name: linked?.name ?? contact.name,
      email: contact.email,
      phone: contact.phone,
      organization: contact.organization,
      city: contact.city,
      linkedProfileId: contact.linkedProfileId,
      photoUrl: photo?.url ?? null,
      photoAltText: photo?.altText ?? null,
      match: member ? { profileId: member.id, name: member.name } : null,
      archivedAtUtc: contact.archivedAtUtc,
      noteCount: contact.notes.length,
      isOwn: contact.ownerId === caller.profileId,
      createdAtUtc: contact.createdAtUtc,
    };
  }

  private json(route: Route, status: number, json: unknown) {
    return route.fulfill({ status, json });
  }

  private conflict(route: Route, detail: string) {
    return route.fulfill({ status: 409, json: { status: 409, detail } });
  }
}
