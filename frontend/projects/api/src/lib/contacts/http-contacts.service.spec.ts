import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { CONTACTS_SERVICE, CreateContactRequest } from './contacts.service';
import { HttpContactsService } from './http-contacts.service';

const request: CreateContactRequest = {
  name: 'Kwame Asante',
  email: 'kwame.asante@example.org',
  phone: null,
  organization: 'Maple Street Church',
  city: 'Toronto',
  notes: 'Pastor.',
};

describe('HttpContactsService', () => {
  let service: HttpContactsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: CONTACTS_SERVICE, useClass: HttpContactsService },
      ],
    });
    service = TestBed.inject(CONTACTS_SERVICE) as HttpContactsService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['list', () => service.list('gra'), 'GET', '/api/contacts?q=gra', undefined],
    ['list without a term', () => service.list(), 'GET', '/api/contacts', undefined],
    ['get', () => service.get('c1'), 'GET', '/api/contacts/c1', undefined],
    ['create', () => service.create(request), 'POST', '/api/contacts', request],
    ['update', () => service.update('c1', request), 'PUT', '/api/contacts/c1', request],
    ['listArchived', () => service.listArchived(), 'GET', '/api/contacts/archived', undefined],
    ['archive', () => service.archive('c1'), 'POST', '/api/contacts/c1/archive', undefined],
    ['restore', () => service.restore('c1'), 'POST', '/api/contacts/c1/restore', undefined],
    ['delete', () => service.delete('c1'), 'DELETE', '/api/contacts/c1', undefined],
    ['getNotes', () => service.getNotes('c1'), 'GET', '/api/contacts/c1/notes', undefined],
    [
      'addNote',
      () => service.addNote('c1', 'Met at the summit'),
      'POST',
      '/api/contacts/c1/notes',
      { body: 'Met at the summit' },
    ],
    [
      'link',
      () => service.link('c1', 'p9', true),
      'POST',
      '/api/contacts/c1/link',
      { profileId: 'p9', discardNotes: true },
    ],
    [
      'describePhoto',
      () => service.describePhoto('c1', 'p1', 'At the coffee morning'),
      'PUT',
      '/api/contacts/c1/photos/p1',
      { altText: 'At the coffee morning' },
    ],
    [
      'setFeaturedPhoto',
      () => service.setFeaturedPhoto('c1', 'p1'),
      'PUT',
      '/api/contacts/c1/photos/p1/featured',
      undefined,
    ],
    [
      'deletePhoto',
      () => service.deletePhoto('c1', 'p1'),
      'DELETE',
      '/api/contacts/c1/photos/p1',
      undefined,
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('lets the contacts page show its own forbidden state', () => {
    service.list().subscribe();

    expect(controller.expectOne('/api/contacts').request.context.get(HANDLES_FORBIDDEN)).toBe(true);
  });

  it('uploads a contact photo as multipart with its description', () => {
    const file = new File(['x'], 'coffee.jpg', { type: 'image/jpeg' });
    service.uploadPhoto('c1', file, 'At the coffee morning').subscribe();

    const req = controller.expectOne('/api/contacts/c1/photos');
    expect(req.request.method).toBe('POST');
    const form = req.request.body as FormData;
    expect(form.get('file')).toBe(file);
    expect(form.get('altText')).toBe('At the coffee morning');
    req.flush(null);
  });

  describe('findDuplicate (L2-116)', () => {
    it('asks for the email, excluding the contact being edited, and maps the match', () => {
      const answers: unknown[] = [];
      service.findDuplicate('nadia@kestrel.example', 'c1').subscribe((a) => answers.push(a));

      const req = controller.expectOne(
        '/api/contacts/duplicates?email=nadia@kestrel.example&excludeId=c1',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
      req.flush({ id: 'c2', name: 'Nadia Petrov' });

      expect(answers).toEqual([{ id: 'c2', name: 'Nadia Petrov' }]);
    });

    it('maps 204 to null', () => {
      const answers: unknown[] = [];
      service.findDuplicate('kwame@example.org').subscribe((a) => answers.push(a));

      controller
        .expectOne('/api/contacts/duplicates?email=kwame@example.org')
        .flush(null, { status: 204, statusText: 'No Content' });

      expect(answers).toEqual([null]);
    });
  });

  describe('photoImage', () => {
    let created: Blob[];

    beforeEach(() => {
      created = [];
      URL.createObjectURL = vi.fn((blob: Blob) => {
        created.push(blob);
        return `blob:image-${created.length}`;
      });
    });

    it('fetches a private contact photo through the API, with the token, as an object URL', () => {
      const urls: string[] = [];
      service.photoImage('/api/contacts/c1/photos/p1/image').subscribe((url) => urls.push(url));

      const req = controller.expectOne('/api/contacts/c1/photos/p1/image');
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['svg'], { type: 'image/svg+xml' }));

      expect(urls).toEqual(['blob:image-1']);
    });

    it('fetches each photo once per session', () => {
      service.photoImage('/api/contacts/c1/photos/p1/image').subscribe();
      controller.expectOne('/api/contacts/c1/photos/p1/image').flush(new Blob(['a']));

      const urls: string[] = [];
      service.photoImage('/api/contacts/c1/photos/p1/image').subscribe((url) => urls.push(url));

      controller.expectNone('/api/contacts/c1/photos/p1/image');
      expect(urls).toEqual(['blob:image-1']);
    });

    it('passes a linked member’s photo URL through unchanged', () => {
      const urls: string[] = [];
      service
        .photoImage('https://photos.example/profiles/p1.jpg?sig=x')
        .subscribe((url) => urls.push(url));

      controller.expectNone(() => true);
      expect(urls).toEqual(['https://photos.example/profiles/p1.jpg?sig=x']);
    });
  });
});
