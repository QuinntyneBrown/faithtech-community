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
    const body: TeamListDto = { members: [], next: null, totalCount: 0 };
    let result: TeamListDto | undefined;
    service.list().subscribe((r) => (result = r));

    const req = controller.expectOne('/api/team');
    expect(req.request.method).toBe('GET');
    req.flush(body);
    expect(result).toEqual(body);
  });

  it('filters by role group and chapter', () => {
    service.list({ role: 'Volunteers', chapterId: 'c-toronto' }).subscribe();

    controller
      .expectOne('/api/team?role=Volunteers&chapter=c-toronto')
      .flush({ members: [], next: null, totalCount: 0 });
  });

  it('continues after the previous page with the same filters', () => {
    service.list({ role: 'Leads', chapterId: 'c-toronto' }, 'cursor-1').subscribe();

    controller
      .expectOne('/api/team?role=Leads&chapter=c-toronto&after=cursor-1')
      .flush({ members: [], next: null, totalCount: 0 });
  });

  it('leaves out an empty chapter', () => {
    service.list({ role: 'Leads', chapterId: '' }).subscribe();

    controller.expectOne('/api/team?role=Leads').flush({ members: [], next: null, totalCount: 0 });
  });
});
