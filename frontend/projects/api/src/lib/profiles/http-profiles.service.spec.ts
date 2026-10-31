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
    const details = { name: 'Ada L', chapterId: 'c-toronto', bio: '' };
    service.updateProfile('p1', details).subscribe();

    const req = controller.expectOne('/api/profiles/p1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(details);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('uploads a photo as multipart with file and alt text', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    service.uploadPhoto('p1', file, 'A smiling person').subscribe();

    const req = controller.expectOne('/api/profiles/p1/photos');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('altText')).toBe('A smiling person');
    req.flush({});
  });

  it('describes, features and deletes a photo', () => {
    service.describePhoto('p1', 'ph1', 'New words').subscribe();
    const describe = controller.expectOne('/api/profiles/p1/photos/ph1');
    expect(describe.request.method).toBe('PUT');
    expect(describe.request.body).toEqual({ altText: 'New words' });
    describe.flush(null);

    service.setFeatured('p1', 'ph1').subscribe();
    const feature = controller.expectOne('/api/profiles/p1/photos/ph1/featured');
    expect(feature.request.method).toBe('PUT');
    feature.flush(null);

    service.deletePhoto('p1', 'ph1').subscribe();
    const del = controller.expectOne('/api/profiles/p1/photos/ph1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
