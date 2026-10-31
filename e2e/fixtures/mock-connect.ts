import { Route } from '@playwright/test';
import { firstRoleCarrying, holds } from './role-definitions';

/** What MockApi shares with the connect fake. */
export interface ConnectContext {
  readonly chapters: { nameOf(id: string | null | undefined): string | null };
  now: Date;
  accounts: Map<string, { email: string; name: string; verified: boolean; profileId: string }>;
  addAccount(account: { email: string; name: string; password: string; verified: boolean }): {
    profileId: string;
  };
  contacts: {
    contacts: {
      id: string;
      ownerId: string;
      email: string | null;
      linkedProfileId: string | null;
      archivedAtUtc: string | null;
    }[];
    add(contact: {
      ownerId: string;
      name: string;
      email: string | null;
      linkedProfileId: string | null;
    }): { id: string };
  };
  addNotification(notification: {
    recipientId: string;
    title: string;
    kind: string;
    linkPath: string;
  }): unknown;
  profiles: Map<
    string,
    {
      id: string;
      name: string;
      chapterId: string | null;
      roles: string[];
      photos: { url: string | null; isFeatured: boolean }[];
    }
  >;
}

export interface ConnectCaller {
  profileId: string;
  roles: string[];
}

/** A City Lead's connect link as the ConnectLinks table holds it, but with the token in the clear. */
export interface MockConnectLink {
  ownerId: string;
  token: string;
}

/**
 * ConnectEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/ConnectEndpoints.cs):
 * one reusable link per City Lead or System Admin, replaced on request (ADR 0021).
 */
export class MockConnect {
  readonly links: MockConnectLink[] = [];
  /** People who used a link before their email was verified: profile id → lead ids (ADR 0022). */
  readonly pending = new Map<string, string[]>();
  private issued = 0;

  constructor(private readonly context: ConnectContext) {}

  /** Gives a lead a link with a known token, as if they had opened My QR code before. */
  addLink(ownerId: string, token = `connect-token-${this.links.length + 1}`): MockConnectLink {
    const link = { ownerId, token };
    this.links.push(link);
    return link;
  }

  /** The owner's profile while their link still works: not suspended, still City Lead or System Admin. */
  ownerOf(token: string) {
    const link = this.links.find((l) => l.token === token);
    const owner = link && this.context.profiles.get(link.ownerId);
    return owner && firstRoleCarrying(owner.roles, 'ConnectLink', 'AdministerOrganisation')
      ? owner
      : undefined;
  }

  /** Answers a /api/connect request, or returns false when the path is not a connect route. */
  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: ConnectCaller | null,
  ): Promise<void> | false {
    const key = `${method} ${url.pathname}`;
    if (key === 'POST /api/connect/lookup') return this.lookUp(route, String(body['token'] ?? ''));
    if (key === 'POST /api/connect/sign-up') return this.signUp(route, body);
    if (key === 'POST /api/connect')
      return this.connectCaller(route, String(body['token'] ?? ''), caller);
    if (url.pathname !== '/api/connect/link') return false;
    if (!caller) return route.fulfill({ status: 401 });
    if (!holds(caller, 'ConnectLink')) return route.fulfill({ status: 403 });
    let link = this.links.find((l) => l.ownerId === caller.profileId);
    if (method === 'POST') {
      // A new token on the same link: the old one stops working (L2-081 AC3).
      if (link) link.token = this.newToken();
      else link = this.addLink(caller.profileId, this.newToken());
    } else if (method === 'GET') {
      link ??= this.addLink(caller.profileId, this.newToken());
    } else {
      return false;
    }
    return route.fulfill({ status: 200, json: { url: `${url.origin}/meet/${link.token}` } });
  }

  /** POST /api/connect/sign-up: L2-001 rules, 202 either way, a pending connection for a new account. */
  private signUp(route: Route, body: Record<string, unknown>) {
    const owner = this.ownerOf(String(body['token'] ?? ''));
    if (!owner) return route.fulfill({ status: 404 });
    const name = String(body['name'] ?? '').trim();
    const email = String(body['email'] ?? '').trim();
    const password = String(body['password'] ?? '');
    const errors: Record<string, string[]> = {};
    if (!name) errors['Name'] = ['Enter your name.'];
    else if (name.length > 100) errors['Name'] = ['Use 100 characters or fewer for your name.'];
    if (password.length < 12) errors['Password'] = ['Use at least 12 characters.'];
    if (Object.keys(errors).length)
      return route.fulfill({ status: 400, json: { status: 400, errors } });
    if (!this.context.accounts.has(email.toLowerCase())) {
      const account = this.context.addAccount({ email, name, password, verified: false });
      this.pending.set(account.profileId, [owner.id]);
    }
    return route.fulfill({ status: 202 });
  }

  /** POST /api/connect: the signed-in member is connected now, or once their email is verified. */
  private connectCaller(route: Route, token: string, caller: ConnectCaller | null) {
    if (!caller) return route.fulfill({ status: 401 });
    const owner = this.ownerOf(token);
    if (!owner) return route.fulfill({ status: 404 });
    const account = [...this.context.accounts.values()].find(
      (a) => a.profileId === caller.profileId,
    )!;
    let outcome = 'Connected';
    if (owner.id === caller.profileId) outcome = 'OwnCode';
    else if (account.verified) this.connect(owner.id, account);
    else {
      outcome = 'Pending';
      const leads = this.pending.get(account.profileId) ?? [];
      if (!leads.includes(owner.id)) this.pending.set(account.profileId, [...leads, owner.id]);
    }
    return route.fulfill({ status: 200, json: { outcome, leadName: owner.name } });
  }

  /**
   * ContactSignedUpHandler's first step when an email is verified: each lead whose link the person used
   * gets a linked contact (their earlier one with that email, or a new one) and a notification.
   */
  verified(profileId: string): void {
    const account = [...this.context.accounts.values()].find((a) => a.profileId === profileId);
    if (!account) return;
    for (const leadId of this.pending.get(profileId) ?? []) this.connect(leadId, account);
    this.pending.delete(profileId);
  }

  /** ContactConnector.ConnectAsync: one contact per email, nothing when already linked. */
  connect(leadId: string, person: { profileId: string; name: string; email: string }): void {
    const contacts = this.context.contacts.contacts.filter((c) => c.ownerId === leadId);
    if (contacts.some((c) => c.linkedProfileId === person.profileId)) return;
    let contact = contacts.find(
      (c) => !c.linkedProfileId && c.email?.toLowerCase() === person.email.toLowerCase(),
    );
    if (contact) {
      contact.archivedAtUtc = null;
      contact.linkedProfileId = person.profileId;
    } else {
      const added = this.context.contacts.add({
        ownerId: leadId,
        name: person.name,
        email: person.email,
        linkedProfileId: person.profileId,
      });
      contact = this.context.contacts.contacts.find((c) => c.id === added.id)!;
    }
    this.context.addNotification({
      recipientId: leadId,
      kind: 'ContactSignedUp',
      title: `${person.name} connected with you`,
      linkPath: `/contacts/${contact.id}`,
    });
  }

  private lookUp(route: Route, token: string) {
    const owner = this.ownerOf(token);
    if (!owner) return route.fulfill({ status: 404 });
    const featured = owner.photos.find((p) => p.isFeatured);
    return route.fulfill({
      status: 200,
      json: {
        leadProfileId: owner.id,
        leadName: owner.name,
        leadPhotoUrl: featured?.url ?? null,
        leadCity: this.context.chapters.nameOf(owner.chapterId),
        leadRole: firstRoleCarrying(owner.roles, 'ConnectLink', 'AdministerOrganisation'),
      },
    });
  }

  private newToken(): string {
    return `Xk3vQ9pL2mRt7wYb4nZc8eHf1jKs6uDa0gVo5iTq${String(++this.issued).padStart(3, '0')}`;
  }
}
