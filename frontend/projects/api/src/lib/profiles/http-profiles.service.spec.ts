import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpProfilesService } from './http-profiles.service';
import { PROFILES_SERVICE } from './profiles.service';

describe('HttpProfilesService', () => {
  let service: HttpProfilesService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: PROFILES_SERVICE, useClass: HttpProfilesService },
      ],
    });
    service = TestBed.inject(PROFILES_SERVICE) as HttpProfilesService;
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('gets a profile by id', () => {
    let name = '';
    service.getProfile('p1').subscribe((p) => (name = p.name));

    const req = controller.expectOne('/api/profiles/p1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'p1', name: 'Ada', featuredPhoto: null, photos: [], roles: [] });
    expect(name).toBe('Ada');
  });

  it('gets the caller’s own profile with "me"', () => {
    service.getProfile('me').subscribe();

    controller.expectOne('/api/profiles/me').flush({});
  });

  it('updates the details with PUT', () => {
    const details = { name: 'Ada L', homeCity: 'Toronto', bio: '' };
    service.updateProfile('p1', details).subscribe();

    const req = controller.expectOne('/api/profiles/p1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(details);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
