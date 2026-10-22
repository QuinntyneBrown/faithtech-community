import type { MockAccount, MockApi } from './mock-api';
import type { MockEvent } from './mock-events';

const DAY = 24 * 60 * 60 * 1000;

/** An ISO time `days` before the fake's "now" (21 October 2026, 12:00 UTC). */
function daysAgo(api: MockApi, days: number): string {
  return new Date(api.now.getTime() - days * DAY).toISOString();
}

/** An event with `rsvps` RSVPs, the first `checkedIn` of them checked in, and checked-in walk-ins. */
function event(
  api: MockApi,
  title: string,
  city: string,
  startsInDays: number,
  { rsvps = 0, checkedIn = 0, walkIns = 0, cancelled = false } = {},
): MockEvent {
  const e = api.events.add({ title, city, isCancelled: cancelled }, startsInDays);
  api.events.addRsvps(e, rsvps);
  e.rsvps.slice(0, checkedIn).forEach((r) => (r.checkedInAt = e.startsAt));
  for (let i = 0; i < walkIns; i++) {
    e.rsvps.push({
      id: `${e.id}-walk-in-${i + 1}`,
      profileId: null,
      guestName: `Walk-in ${i + 1}`,
      guestEmail: null,
      createdAt: e.startsAt,
      checkedInAt: e.startsAt,
      isWalkIn: true,
    });
  }
  return e;
}

export interface ReportData {
  staff: MockAccount;
  admin: MockAccount;
  grace: MockAccount;
}

/**
 * The data set the Reports specs read (ADR 0026). For All cities and the last 30 days the report is:
 * - Members 9, "+3 in the last 30 days": verified, unsuspended profiles; Una (unverified) and Sid (suspended) are
 *   left out, and Tomás joined before the window.
 * - Members by city: Toronto 3, Halifax 2, Vancouver 2, Austin 1, Other 1 (Nia has no home city).
 * - New members by month: Sep 1, Oct so far 2.
 * - Events held 2, "1 cancelled"; RSVPs 8, "88% checked in" (walk-ins excluded); the Calgary kickoff is too old.
 * - Partners confirmed 2 "of 4 in the pipeline": the archived duplicate is left out; Orphan Co is "No city".
 * - Announcements 1: Mira's is older than 30 days.
 * - Cities: Austin, Calgary, Halifax, Toronto, Vancouver. Calgary in the last 30 days is empty.
 */
export function seedReportData(api: MockApi): ReportData {
  const member = (
    name: string,
    city: string | null,
    joinedDaysAgo: number | null,
    extra: Partial<MockAccount> = {},
  ) => {
    const account = api.addAccount({
      name,
      email: `${name.split(' ')[0].toLowerCase()}@example.org`,
      ...extra,
    });
    const profile = api.profiles.get(account.profileId)!;
    profile.homeCity = city;
    profile.joinedAtUtc = joinedDaysAgo === null ? null : daysAgo(api, joinedDaysAgo);
    return account;
  };

  const staff = member('Priya Shah', 'Toronto', null, { roles: ['Staff'] });
  const grace = member('Grace Okonkwo', 'Toronto', 11, { roles: ['CityLead'] });
  member('Tomás Ortega', 'Toronto', 81);
  const ruth = member('Ruth Alvarez', 'Austin', 26);
  const mira = member('Mira Chen', 'Vancouver', 6);
  member('Kai Moreau', 'Vancouver', null);
  member('Sam Rivera', 'Halifax', null);
  const admin = member('Lee Park', 'Halifax', null, { roles: ['SystemAdmin'] });
  member('Nia Brooks', null, null);
  member('Una Unverified', 'Moncton', 1, { verified: false });
  member('Sid Suspended', 'Regina', 1, { suspended: true });

  event(api, 'Vancouver Builders Night', 'Vancouver', -12, { rsvps: 5, checkedIn: 4, walkIns: 1 });
  event(api, 'Toronto Builders Night', 'Toronto', -5, { rsvps: 3, checkedIn: 3 });
  event(api, 'Austin Faith & AI Panel', 'Austin', -3, { rsvps: 2, cancelled: true });
  event(api, 'Toronto Prayer & Planning', 'Toronto', 7, { rsvps: 4 });
  event(api, 'Calgary Kickoff', 'Calgary', -60, { rsvps: 6, checkedIn: 6 });

  const kestrel = api.partners.add({
    name: 'Kestrel Labs',
    ownerId: grace.profileId,
    stage: 'Confirmed',
  });
  api.partners.add({ name: 'Maple Church', ownerId: grace.profileId, stage: 'Lead' });
  api.partners.add({ name: 'Lone Star Studio', ownerId: ruth.profileId, stage: 'InFunnel' });
  api.partners.add({ name: 'Orphan Co', ownerId: null, stage: 'Confirmed' });
  api.partners.add({
    name: 'Kestrel Labs Inc',
    ownerId: grace.profileId,
    stage: 'Confirmed',
    archivedAtUtc: daysAgo(api, 2),
    mergedIntoId: kestrel.id,
  });

  const announcement = {
    subject: 'Builders Night',
    body: 'See you there.',
    audience: { kind: 'Everyone' },
    alsoEmail: false,
    recipientIds: [],
  };
  api.announcements.add({ ...announcement, senderId: grace.profileId, sentAt: daysAgo(api, 2) });
  api.announcements.add({ ...announcement, senderId: mira.profileId, sentAt: daysAgo(api, 40) });

  return { staff, admin, grace };
}

/** A lead's private contacts, with emails, cities and notes, which no report may read (L2-100 AC6). */
export function addPrivateContacts(api: MockApi, ownerId: string): void {
  api.contacts.add({
    ownerId,
    name: 'Hidden Harriet',
    email: 'harriet@secret.example',
    city: 'Toronto',
  });
  api.contacts.add({
    ownerId,
    name: 'Quiet Quentin',
    email: 'quentin@secret.example',
    city: 'Saskatoon',
  });
}
