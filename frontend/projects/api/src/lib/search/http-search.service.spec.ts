// Traces to: L2-026 AC4
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpSearchService } from './http-search.service';
import { SEARCH_SERVICE } from './search.service';

describe('HttpSearchService', () => {
  let service: HttpSearchService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...apiTestProviders(), { provide: SEARCH_SERVICE, useClass: HttpSearchService }],
    });
    service = TestBed.inject(SEARCH_SERVICE) as HttpSearchService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('searches with the term', () => {
    service.search('ada').subscribe();

    const req = controller.expectOne('/api/search?q=ada');
    expect(req.request.method).toBe('GET');
    req.flush({ groups: [] });
  });

  it.each(['', 'a', ' a '])('does not call the API for the short term "%s"', (term) => {
    let result: unknown;
    service.search(term).subscribe((r) => (result = r));

    controller.expectNone(() => true);
    expect(result).toEqual({ groups: [] });
  });
});
