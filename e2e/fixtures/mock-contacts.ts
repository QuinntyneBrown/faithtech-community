import { Route } from '@playwright/test';

/** What MockApi shares with the contacts fake: the signed-in caller and the accounts and profiles. */
export interface ContactsContext {
  now: Date;
  accounts: Map<string, { email: string; verified: boolean; profileId: string }>;
  profiles: Map<
    string,
    {
      id: string;
      name: string;
      photos: { url: string | null; altText: string; isFeatured: boolean }[];
    }
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

/** A contact photo. Its image is served only by the contacts API, to the owner and System Admin (ADR 0017). */
export interface MockContactPhoto {
  id: string;
  altText: string;
  isFeatured: boolean;
  uploadedAt: string;
  /** False while the image waits for storage. */
  isStored: boolean;
  /** The colour of the tiny SVG the image route answers with. */
  colour: string;
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
  photos: MockContactPhoto[];
}

const LEAD_ROLES = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ContactsEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/ContactsEndpoints.cs):
 * lead roles and System Admin only, another lead's contact is 404 (ADR 0014).
 */
export class MockContacts {
  readonly contacts: MockContact[] = [];
  /** When true, uploads are saved as storing (L2-059 AC1). */
  storageDown = false;
  /** Image requests and whether they carried a caller. */
  readonly imageRequests: { path: string; signedIn: boolean }[] = [];
  private notes = 0;
  private photoCount = 0;

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
      photos: [],
      ...contact,
    };
    if (full.photos.length > 0 && !full.photos.some((p) => p.isFeatured))
      full.photos[0].isFeatured = true;
    this.contacts.push(full);
    return full;
  }

  /** A note dated `daysAgo` before "now". */
  note(body: string, daysAgo = 0): MockNote {
    const at = new Date(this.context.now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return { id: `note-${++this.notes}`, body, createdAtUtc: at.toISOString() };
  }

  /** A stored photo uploaded `minutes` after "now"; the first photo of a contact is featured by `add`. */
  photo(altText: string, minutes = 0, colour = '#0f766e'): MockContactPhoto {
    return {
      id: `contact-photo-${++this.photoCount}`,
      altText,
      isFeatured: false,
      uploadedAt: new Date(this.context.now.getTime() + minutes * 60_000).toISOString(),
      isStored: true,
      colour,
    };
  }

  /** The API path of a photo's image, as ContactPhotoDto.Url gives it. */
  imageUrl(contact: MockContact, photo: MockContactPhoto): string | null {
    return photo.isStored ? `/api/contacts/${contact.id}/photos/${photo.id}/image` : null;
  }

  /** Answers a /api/contacts request, or returns false when the path is not a contacts route. */
  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockCaller | null,
  ): Promise<void> | false {
    const photoRoute =
      /^\/api\/contacts\/([^/]+)\/photos(?:\/([^/]+))?(?:\/(featured|image))?$/.exec(url.pathname);
    if (photoRoute) return this.photos(route, method, photoRoute, body, caller, url.pathname);
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

  /** ContactsEndpoints' photo routes: 404 for anyone but the owner and System Admin (L2-058). */
  private photos(
    route: Route,
    method: string,
    [, id, photoId, action]: RegExpExecArray,
    body: Record<string, unknown>,
    caller: MockCaller | null,
    path: string,
  ) {
    if (action === 'image') this.imageRequests.push({ path, signedIn: !!caller });
    if (!caller) return route.fulfill({ status: 401 });
    const contact = this.contacts.find((c) => c.id === id);
    const visible =
      contact && (contact.ownerId === caller.profileId || caller.roles.includes('SystemAdmin'));
    if (!contact || !visible) return route.fulfill({ status: 404 });
    const invalid = (field: string, message: string) =>
      this.json(route, 400, { status: 400, errors: { [field]: [message] } });

    if (method === 'POST' && !photoId) {
      const altText = String(body['altText'] ?? '').trim();
      if (contact.photos.length >= 10) {
        return invalid(
          'File',
          'That’s 10 photos, the most a contact can have. Remove one to add another.',
        );
      }
      if (!altText) return invalid('AltText', 'Describe this photo.');
      const photo = this.photo(altText, this.photoCount);
      photo.isStored = !this.storageDown;
      photo.isFeatured = contact.photos.length === 0;
      contact.photos.push(photo);
      return this.json(route, 201, this.photoDto(contact, photo));
    }

    const photo = contact.photos.find((p) => p.id === photoId);
    if (!photo) return route.fulfill({ status: 404 });
    if (method === 'GET' && action === 'image') {
      if (!photo.isStored) return route.fulfill({ status: 404 });
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${photo.colour}"/></svg>`;
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        headers: { 'cache-control': 'private, max-age=300' },
        body: svg,
      });
    }
    if (method === 'PUT' && action === 'featured') {
      for (const p of contact.photos) p.isFeatured = p === photo;
      return route.fulfill({ status: 204 });
    }
    if (method === 'PUT' && !action) {
      const altText = String(body['altText'] ?? '').trim();
      if (!altText) return invalid('AltText', 'Describe this photo.');
      photo.altText = altText;
      return route.fulfill({ status: 204 });
    }
    if (method === 'DELETE' && !action) {
      contact.photos = contact.photos.filter((p) => p !== photo);
      if (photo.isFeatured && contact.photos.length > 0) {
        const newest = [...contact.photos].sort((a, b) =>
          b.uploadedAt.localeCompare(a.uploadedAt),
        )[0];
        newest.isFeatured = true;
      }
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 405 });
  }

  private photoDto(contact: MockContact, photo: MockContactPhoto) {
    return {
      id: photo.id,
      url: this.imageUrl(contact, photo),
      altText: photo.altText,
      isFeatured: photo.isFeatured,
      uploadedAt: photo.uploadedAt,
      isStored: photo.isStored,
    };
  }

  /** The card's or header's photo: the linked member's featured photo, else the contact's own stored one. */
  private featured(contact: MockContact): { url: string | null; altText: string | null } {
    const linked = contact.linkedProfileId
      ? this.context.profiles.get(contact.linkedProfileId)
      : null;
    if (linked) {
      const photo = linked.photos.find((p) => p.isFeatured) ?? null;
      return { url: photo?.url ?? null, altText: photo?.altText ?? null };
    }
    const own = contact.photos.find((p) => p.isFeatured) ?? null;
    return { url: own ? this.imageUrl(contact, own) : null, altText: own?.altText ?? null };
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
      photoUrl: this.featured(contact).url,
      photoAltText: this.featured(contact).altText,
      noteCount: contact.notes.length,
      createdAtUtc: contact.createdAtUtc,
    };
  }

  private dto(contact: MockContact, caller: MockCaller) {
    const linked = contact.linkedProfileId
      ? this.context.profiles.get(contact.linkedProfileId)
      : null;
    const photo = this.featured(contact);
    const member = linked ? null : this.member(contact.email);
    return {
      id: contact.id,
      name: linked?.name ?? contact.name,
      email: contact.email,
      phone: contact.phone,
      organization: contact.organization,
      city: contact.city,
      linkedProfileId: contact.linkedProfileId,
      photoUrl: photo.url,
      photoAltText: photo.altText,
      match: member ? { profileId: member.id, name: member.name } : null,
      archivedAtUtc: contact.archivedAtUtc,
      noteCount: contact.notes.length,
      isOwn: contact.ownerId === caller.profileId,
      createdAtUtc: contact.createdAtUtc,
      photos: [...contact.photos]
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        .map((p) => this.photoDto(contact, p)),
    };
  }

  private json(route: Route, status: number, json: unknown) {
    return route.fulfill({ status, json });
  }

  private conflict(route: Route, detail: string) {
    return route.fulfill({ status: 409, json: { status: 409, detail } });
  }
}
