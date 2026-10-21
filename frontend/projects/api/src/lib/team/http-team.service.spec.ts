/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/team/team-list
 */
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpTeamService } from './http-team.service';
import { TEAM_SERVICE } from './team.service';

describe('HttpTeamService', () => {
  let service: HttpTeamService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...apiTestProviders(), { provide: TEAM_SERVICE, useClass: HttpTeamService }],
    });
    service = TestBed.inject(TEAM_SERVICE) as HttpTeamService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('lists the whole team without a role filter', () => {
    service.list().subscribe();

    const req = controller.expectOne('/api/team');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('filters by role', () => {
    service.list('Volunteer').subscribe();

    controller.expectOne('/api/team?role=Volunteer').flush([]);
  });
});
