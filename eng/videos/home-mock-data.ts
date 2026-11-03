import { MockAccount, MockApi } from '../../e2e/fixtures/mock-api';
import { featuredPhoto, Scene } from './photos';

/** A member with a demo portrait; the id is chosen so their colour matches the mock (ADR 0008). */
function person(
  api: MockApi,
  id: string,
  name: string,
  scene: Scene,
): { id: string; name: string } {
  api.addProfile({ id, name, roles: ['Volunteer'], photos: [featuredPhoto(scene)] });
  return { id, name };
}

/**
 * Seeds the fake API with what docs/mocks/pages/home/default.html shows on Wednesday 21 October 2026, 3:42 pm in
 * Toronto: three events coming up, a 4 / 3 / 5 pipeline and four activity items, three unread. Returns Grace
 * Okonkwo, the City Lead, with her photo. The home and app-shell-tour journeys both compare against that mock.
 */
export async function seedHomeMock(api: MockApi): Promise<MockAccount> {
  api.now = new Date('2026-10-21T19:42:00Z');
  await api.freezeBrowserClock();
  api.events.add({
    title: 'City Team Prayer & Planning',
    startsAt: '2026-10-28T23:00:00Z',
    endsAt: '2026-10-29T00:30:00Z',
    format: 'Online',
    venue: null,
    onlineLink: 'https://meet.example.org/prayer',
  });
  const builders = api.events.add({
    title: 'Toronto Builders Night',
    startsAt: '2026-11-06T23:30:00Z',
    endsAt: '2026-11-07T02:00:00Z',
    visibility: 'Public',
  });
  api.events.addRsvps(builders, 34);
  const hackathon = api.events.add({
    title: 'Hackathon: Tech for Shelters',
    startsAt: '2026-11-14T14:00:00Z',
    endsAt: '2026-11-15T22:00:00Z',
    venue: 'Trinity Community Centre',
    visibility: 'Public',
  });
  api.events.addRsvps(hackathon, 52);
  const stages = { lead: 4, 'in-funnel': 3, confirmed: 5 };
  for (const [stage, count] of Object.entries(stages)) {
    for (let i = 1; i <= count; i++) api.partners.add({ name: `${stage} partner ${i}`, stage });
  }
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
    profileId: 'profile-grace7',
  });
  api.profiles.get(grace.profileId)!.photos.push(featuredPhoto('grace-okonkwo'));
  const tomas = person(api, 'profile-tomas', 'Tomás Ortega', 'tomas-ortega');
  const marcus = person(api, 'profile-marcus1', 'Marcus Lee', 'marcus-lee');
  const hannah = person(api, 'profile-hannah5', 'Hannah Kim', 'hannah-kim');
  const ruth = person(api, 'profile-ruth1', 'Ruth Alvarez', 'ruth-alvarez');
  const notify = (
    actor: { id: string; name: string },
    kind: string,
    title: string,
    linkPath: string,
    minutesAgo: number,
  ) =>
    api.addNotification(
      {
        recipientId: grace.profileId,
        kind,
        title,
        linkPath,
        actorId: actor.id,
        actorName: actor.name,
      },
      minutesAgo,
    );
  notify(
    tomas,
    'ContactSignedUp',
    'Tomás Ortega just joined FaithTech',
    '/contacts/contact-9',
    240,
  );
  notify(
    marcus,
    'ResourceShared',
    'Marcus Lee shared “Builders Night run sheet” with you',
    '/resources/resource-4',
    1412,
  );
  notify(
    hannah,
    'Announcement',
    'November hackathon: teams are forming',
    '/announcements/announcement-2',
    3222,
  );
  // Three unread, as the mock's bell shows: Grace has already seen Ruth's.
  notify(
    ruth,
    'InviteAccepted',
    'Ruth Alvarez accepted your invite',
    `/people/${ruth.id}`,
    4320,
  ).readAt = '2026-10-18T20:00:00Z';
  return grace;
}
