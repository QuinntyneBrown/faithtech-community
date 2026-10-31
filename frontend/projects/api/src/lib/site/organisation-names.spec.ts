import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AUTH_SERVICE, AuthService, CurrentUser } from '../auth/auth.service';
import { FALLBACK_ORGANISATION_NAME, OrganisationNames } from './organisation-names';
import { SITE_SERVICE, Site, SiteService } from './site.service';

const site: Site = {
  name: 'Northside Makers',
  shortName: 'Northside',
  chapterLabel: null,
  communityOrigin: 'https://app.northside.test',
};

function names(user: CurrentUser | null, loaded: Site | null): OrganisationNames {
  TestBed.configureTestingModule({
    providers: [
      { provide: AUTH_SERVICE, useValue: { currentUser: signal(user) } as Partial<AuthService> },
      { provide: SITE_SERVICE, useValue: { site: signal(loaded) } as Partial<SiteService> },
    ],
  });
  return TestBed.inject(OrganisationNames);
}

describe('OrganisationNames', () => {
  it('reads the names from /api/site before sign-in', () => {
    const n = names(null, site);

    expect([n.name(), n.shortName()]).toEqual(['Northside Makers', 'Northside']);
    expect(n.unreachable('Nothing was changed — try again.')).toBe(
      'We couldn’t reach Northside. Nothing was changed — try again.',
    );
  });

  it('prefers the signed-in member’s organisation from /api/me', () => {
    const n = names(
      {
        id: 'u1',
        profileId: 'p1',
        name: 'Ana Lima',
        email: 'ana@example.org',
        emailVerified: true,
        roles: [],
        organisation: {
          slug: 'harbour',
          name: 'Harbour Builders',
          shortName: 'Harbour',
          host: 'app.harbour.test',
          chapterLabel: null,
        },
      },
      site,
    );

    expect([n.name(), n.shortName()]).toEqual(['Harbour Builders', 'Harbour']);
  });

  it('falls back to a neutral name when neither could be read', () => {
    const n = names(null, null);

    expect(n.shortName()).toBe(FALLBACK_ORGANISATION_NAME);
  });
});
