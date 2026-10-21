// Traces to: L2-019
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpTeamService } from './http-team.service';
import { TEAM_SERVICE, TeamListDto } from './team.service';

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

  it('lists the whole team without filters', () => {
    const body: TeamListDto = { members: [], cities: ['Toronto'] };
    let result: TeamListDto | undefined;
    service.list().subscribe((r) => (result = r));

    const req = controller.expectOne('/api/team');
    expect(req.request.method).toBe('GET');
    req.flush(body);
    expect(result).toEqual(body);
  });

  it('filters by role group and city', () => {
    service.list({ role: 'Volunteers', city: 'Toronto' }).subscribe();

    controller
      .expectOne('/api/team?role=Volunteers&city=Toronto')
      .flush({ members: [], cities: [] });
  });

  it('leaves out an empty city', () => {
    service.list({ role: 'Leads', city: '' }).subscribe();

    controller.expectOne('/api/team?role=Leads').flush({ members: [], cities: [] });
  });
});
