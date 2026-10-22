// Traces to: L2-053
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HANDLES_FORBIDDEN } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { HttpPeopleService } from './http-people.service';
import { PEOPLE_SERVICE } from './people.service';

describe('HttpPeopleService', () => {
  let service: HttpPeopleService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...apiTestProviders(), { provide: PEOPLE_SERVICE, useClass: HttpPeopleService }],
    });
    service = TestBed.inject(PEOPLE_SERVICE) as HttpPeopleService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('searches people by term and page and shows its own forbidden state', () => {
    service.search('ruth', 2).subscribe();

    const req = controller.expectOne('/api/people?q=ruth&page=2');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
    req.flush({ items: [], page: 2, pageSize: 25, totalCount: 0 });
  });

  it('leaves out an empty term and starts on page 1', () => {
    service.search('').subscribe();

    controller
      .expectOne('/api/people?page=1')
      .flush({ items: [], page: 1, pageSize: 25, totalCount: 0 });
  });
});
