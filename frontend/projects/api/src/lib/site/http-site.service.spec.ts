import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HANDLES_SERVER_ERROR } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { HttpSiteService } from './http-site.service';
import { SITE_SERVICE, Site } from './site.service';

const northside: Site = {
  name: 'Northside Makers',
  shortName: 'Northside',
  chapterLabel: null,
  communityOrigin: 'https://app.northside.test',
};

describe('HttpSiteService', () => {
  let service: HttpSiteService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...apiTestProviders(), { provide: SITE_SERVICE, useClass: HttpSiteService }],
    });
    service = TestBed.inject(SITE_SERVICE) as HttpSiteService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('loads the host’s organisation from /api/site', async () => {
    const loading = service.load();

    const req = controller.expectOne('/api/site');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush(northside);
    await loading;

    expect(service.site()).toEqual(northside);
  });

  it('leaves the site empty instead of failing the app when the request fails', async () => {
    const loading = service.load();

    controller.expectOne('/api/site').flush(null, { status: 503, statusText: 'Unavailable' });

    await expect(loading).resolves.toBeUndefined();
    expect(service.site()).toBeNull();
  });
});
