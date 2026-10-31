import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpOrganisationService } from './http-organisation.service';
import { ORGANISATION_SERVICE, OrganisationDto } from './organisation.service';

const ORGANISATION: OrganisationDto = {
  name: 'FaithTech Community',
  shortName: 'FaithTech',
  chapterLabel: null,
  roles: [
    { id: 'r1', key: 'Volunteer', name: 'Volunteer', description: '', chapterScopable: true },
  ],
};

describe('HttpOrganisationService', () => {
  let service: HttpOrganisationService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: ORGANISATION_SERVICE, useClass: HttpOrganisationService },
      ],
    });
    service = TestBed.inject(ORGANISATION_SERVICE) as HttpOrganisationService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('reads the organisation once and caches it for the session', () => {
    const answers: OrganisationDto[] = [];
    service.get().subscribe((o) => answers.push(o));
    controller.expectOne('/api/organisation').flush(ORGANISATION);
    service.get().subscribe((o) => answers.push(o));

    controller.expectNone('/api/organisation');
    expect(answers).toEqual([ORGANISATION, ORGANISATION]);
  });

  it('asks again after a failure', () => {
    service.get().subscribe({ error: () => undefined });
    controller
      .expectOne('/api/organisation')
      .flush(null, { status: 500, statusText: 'Server Error' });
    service.get().subscribe();

    controller.expectOne('/api/organisation').flush(ORGANISATION);
  });
});
