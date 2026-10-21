/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/profiles/view-profile
 *   - docs/detailed-designs/profiles/edit-own-profile
 *   - docs/detailed-designs/profiles/manage-profile-photos
 */
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

  it('gets a profile', () => {
    let name = '';
    service.getProfile('p1').subscribe((p) => (name = p.name));

    const req = controller.expectOne('/api/profiles/p1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'p1', name: 'Ada', featuredPhoto: null, photos: [], roles: [] });
    expect(name).toBe('Ada');
  });

  it('updates the name with PUT', () => {
    service.updateProfile('p1', { name: 'Ada L' }).subscribe();

    const req = controller.expectOne('/api/profiles/p1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Ada L' });
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
    req.flush({
      id: 'ph1',
      url: '/u',
      altText: 'A smiling person',
      isFeatured: true,
      uploadedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('features and deletes a photo', () => {
    service.setFeatured('p1', 'ph1').subscribe();
    const feature = controller.expectOne('/api/profiles/p1/photos/ph1/featured');
    expect(feature.request.method).toBe('PUT');
    feature.flush(null, { status: 204, statusText: 'No Content' });

    service.deletePhoto('p1', 'ph1').subscribe();
    const del = controller.expectOne('/api/profiles/p1/photos/ph1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });
});
